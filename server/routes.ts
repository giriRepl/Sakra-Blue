import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPackageSchema, insertSmsTemplateSchema, type Package, type Service } from "@shared/schema";
import { z } from "zod";
import { addMonths } from "date-fns";

// In-memory OTP store (for demo purposes)
const otpStore = new Map<string, { otp: string; expiresAt: Date; verified: boolean }>();

// In-memory admin session store (for demo purposes)
const adminSessionStore = new Map<string, { adminId: string; email: string; expiresAt: Date }>();

// Dummy OTP for testing
const DUMMY_OTP = "79";

// Simple token generation (for demo)
function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Admin authentication middleware
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin authentication required" });
  }

  const token = authHeader.substring(7);
  const session = adminSessionStore.get(token);

  if (!session) {
    return res.status(401).json({ error: "Invalid or expired admin session" });
  }

  if (new Date() > session.expiresAt) {
    adminSessionStore.delete(token);
    return res.status(401).json({ error: "Admin session expired" });
  }

  // Attach admin info to request for use in handlers
  (req as any).adminEmail = session.email;
  (req as any).adminId = session.adminId;
  
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============ PUBLIC PACKAGE ROUTES ============
  
  // Get all active packages (for landing page)
  app.get("/api/packages/active", async (req, res) => {
    try {
      const packages = await storage.getActivePackages();
      res.json(packages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  // Get single package by ID (public for viewing)
  app.get("/api/packages/:id", async (req, res) => {
    try {
      const pkg = await storage.getPackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch package" });
    }
  });

  // ============ CUSTOMER AUTH ROUTES ============

  // Send OTP
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { mobile } = req.body;
      if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({ error: "Invalid mobile number" });
      }

      // Store OTP (in production, this would send an actual SMS)
      otpStore.set(mobile, {
        otp: DUMMY_OTP,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verified: false,
      });

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Verify OTP (for purchase flow)
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { mobile, otp } = req.body;
      const session = otpStore.get(mobile);

      if (!session) {
        return res.status(400).json({ error: "OTP not found. Please request a new one." });
      }

      if (new Date() > session.expiresAt) {
        otpStore.delete(mobile);
        return res.status(400).json({ error: "OTP expired. Please request a new one." });
      }

      if (session.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      session.verified = true;
      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Customer login
  app.post("/api/auth/customer-login", async (req, res) => {
    try {
      const { mobile, otp } = req.body;
      const session = otpStore.get(mobile);

      if (!session || session.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Get or create customer
      let customer = await storage.getCustomerByMobile(mobile);
      if (!customer) {
        customer = await storage.createCustomer({ mobile });
      }

      const token = generateToken();
      otpStore.delete(mobile);

      res.json({ customer, token });
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // ============ CUSTOMER PURCHASE ROUTES ============

  // Create purchase
  app.post("/api/purchases", async (req, res) => {
    try {
      const { mobile, packageId } = req.body;

      // Verify OTP was confirmed
      const session = otpStore.get(mobile);
      if (!session?.verified) {
        return res.status(400).json({ error: "Please verify OTP first" });
      }

      // Get or create customer
      let customer = await storage.getCustomerByMobile(mobile);
      if (!customer) {
        customer = await storage.createCustomer({ mobile });
      }

      // Get package
      const pkg = await storage.getPackage(packageId);
      if (!pkg || !pkg.isActive) {
        return res.status(404).json({ error: "Package not found or inactive" });
      }

      // Create purchase - calculate expiry from validityMonths
      const expiryDate = addMonths(new Date(), pkg.validityMonths);
      const purchase = await storage.createPurchase({
        customerId: customer.id,
        packageId: pkg.id,
        packageSnapshot: pkg,
        purchaseDate: new Date(),
        expiryDate,
        amountPaid: pkg.price,
      });

      otpStore.delete(mobile);

      res.json(purchase);
    } catch (error) {
      res.status(500).json({ error: "Failed to create purchase" });
    }
  });

  // Add members to purchase
  app.post("/api/purchases/:purchaseId/members", async (req, res) => {
    try {
      const { purchaseId } = req.params;
      const { members: membersList } = req.body;

      // Validate each member
      for (const member of membersList) {
        if (!member.name || member.age === undefined || !member.type) {
          return res.status(400).json({ error: "Each member requires name, age, and type" });
        }
        // Validate age based on type
        if (member.type === "adult" && member.age < 16) {
          return res.status(400).json({ error: `Adult "${member.name}" must be 16 years or older` });
        }
        if (member.type === "kid" && member.age >= 16) {
          return res.status(400).json({ error: `Kid "${member.name}" must be under 16 years` });
        }
      }

      const createdMembers = await storage.createMembersForPurchase(purchaseId, membersList);
      res.json(createdMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to add members" });
    }
  });

  // Update customer profile
  app.post("/api/customers/profile", async (req, res) => {
    try {
      const customerId = req.headers["x-customer-id"] as string;
      
      if (!customerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { name, age, location, gender } = req.body;
      
      if (!name || !age || !location || !gender) {
        return res.status(400).json({ error: "Name, age, location, and gender are required" });
      }

      const updated = await storage.updateCustomerProfile(customerId, { name, age, location, gender });
      if (!updated) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Get customer purchases
  app.get("/api/customers/purchases", async (req, res) => {
    try {
      const customerId = req.headers["x-customer-id"] as string;
      
      if (!customerId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const purchases = await storage.getPurchasesByCustomer(customerId);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  // ============ ADMIN AUTH ROUTES ============

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check for static password for testing
      if (password !== "saKra123") {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Get or create admin
      let admin = await storage.getAdminByEmail(email);
      if (!admin) {
        admin = await storage.createAdmin({ email, password: "saKra123" });
      }

      const token = generateToken();
      
      // Store admin session
      adminSessionStore.set(token, {
        adminId: admin.id,
        email: admin.email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Don't send password in response
      const { password: _, ...adminWithoutPassword } = admin;
      res.json({ admin: adminWithoutPassword, token });
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Admin logout
  app.post("/api/admin/logout", requireAdminAuth, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        adminSessionStore.delete(token);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  // ============ ADMIN PROTECTED ROUTES ============

  // Get all packages (for admin)
  app.get("/api/packages", requireAdminAuth, async (req, res) => {
    try {
      const packages = await storage.getAllPackages();
      res.json(packages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  // Create package
  app.post("/api/packages", requireAdminAuth, async (req, res) => {
    try {
      const result = insertPackageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid package data", details: result.error });
      }

      const pkg = await storage.createPackage(result.data);
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to create package" });
    }
  });

  // Update package
  app.put("/api/packages/:id", requireAdminAuth, async (req, res) => {
    try {
      const result = insertPackageSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid package data", details: result.error });
      }

      const pkg = await storage.updatePackage(req.params.id, result.data);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to update package" });
    }
  });

  // Toggle package active status
  app.patch("/api/packages/:id/toggle", requireAdminAuth, async (req, res) => {
    try {
      const pkg = await storage.togglePackageActive(req.params.id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle package status" });
    }
  });

  // ============ ADMIN STATS ROUTES ============

  // Get dashboard stats
  app.get("/api/admin/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ============ ADMIN REDEMPTION ROUTES ============

  // Get purchases by mobile (for admin)
  app.get("/api/admin/purchases", requireAdminAuth, async (req, res) => {
    try {
      const mobile = req.query.mobile as string;
      if (!mobile) {
        return res.status(400).json({ error: "Mobile number required" });
      }

      const purchases = await storage.getPurchasesByMobile(mobile);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  // Get purchases by mobile (path parameter version for frontend compatibility)
  app.get("/api/admin/purchases/:mobile", requireAdminAuth, async (req, res) => {
    try {
      const { mobile } = req.params;
      const purchases = await storage.getPurchasesByMobile(mobile);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  // Redeem services
  app.post("/api/admin/redeem", requireAdminAuth, async (req, res) => {
    try {
      const { purchaseId, services, redeemedBy } = req.body;

      if (!purchaseId || !services || !Array.isArray(services) || !redeemedBy) {
        return res.status(400).json({ error: "Invalid redemption data" });
      }

      const redemptions = [];
      for (const service of services) {
        const redemption = await storage.createRedemption({
          purchaseId,
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          redeemedBy,
        });
        redemptions.push(redemption);
      }

      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to redeem services" });
    }
  });

  // Admin update customer profile
  app.patch("/api/admin/customers/:id", requireAdminAuth, async (req, res) => {
    try {
      const { name, age, location, gender } = req.body;
      const customerId = req.params.id;

      const customer = await storage.updateCustomerProfile(customerId, {
        name,
        age,
        location,
        gender,
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer profile" });
    }
  });

  // Admin assign package to customer
  app.post("/api/admin/assign-package", requireAdminAuth, async (req, res) => {
    try {
      const { packageId, mobile, holder, members } = req.body;

      if (!packageId || !mobile || !holder) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate mobile
      if (!/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({ error: "Invalid mobile number" });
      }

      // Get package
      const pkg = await storage.getPackage(packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Get or create customer
      let customer = await storage.getCustomerByMobile(mobile);
      if (!customer) {
        customer = await storage.createCustomer({
          mobile,
          name: holder.name,
          age: holder.age,
          location: holder.location,
          gender: holder.gender,
        });
      } else {
        // Update customer with holder details
        customer = await storage.updateCustomerProfile(customer.id, {
          name: holder.name,
          age: holder.age,
          location: holder.location,
          gender: holder.gender,
        });
      }

      if (!customer) {
        return res.status(500).json({ error: "Failed to create/update customer" });
      }

      // Create purchase
      const expiryDate = addMonths(new Date(), pkg.validityMonths);
      const purchase = await storage.createPurchase({
        customerId: customer.id,
        packageId: pkg.id,
        packageSnapshot: pkg,
        purchaseDate: new Date(),
        expiryDate,
        amountPaid: pkg.price,
      });

      // Create members if provided
      if (members && Array.isArray(members) && members.length > 0) {
        const membersList = members.map((m: any) => ({
          name: m.name,
          age: m.age,
          type: m.type as "adult" | "kid",
          relation: m.relation,
        }));
        await storage.createMembersForPurchase(purchase.id, membersList);
      }

      // Add account holder as a member too (primary)
      await storage.createMember({
        purchaseId: purchase.id,
        name: holder.name,
        age: holder.age,
        type: "adult",
        relation: "Self",
      });

      res.json({ 
        success: true, 
        purchase,
        message: "Package assigned successfully" 
      });
    } catch (error) {
      console.error("Error assigning package:", error);
      res.status(500).json({ error: "Failed to assign package" });
    }
  });

  // ==========================================
  // SUPER ADMIN - SMS API (Karix Integration)
  // ==========================================

  const SUPERADMIN_PASSCODE = "7999";

  function requireSuperAdminAuth(req: Request, res: Response, next: NextFunction) {
    const passcode = req.headers["x-superadmin-passcode"];
    if (!passcode || passcode !== SUPERADMIN_PASSCODE) {
      return res.status(401).json({ error: "Super admin authentication required" });
    }
    next();
  }

  app.post("/api/superadmin/send-sms", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        mobile: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit mobile number required"),
        message: z.string().min(1, "Message is required"),
      });

      const { mobile, message } = schema.parse(req.body);

      const apiKey = process.env.KARIX_API_KEY;
      const senderId = process.env.KARIX_SENDER_ID;
      const entityId = process.env.KARIX_ENTITY_ID;

      if (!apiKey || !senderId || !entityId) {
        return res.status(500).json({ error: "SMS gateway credentials not configured" });
      }

      const dest = `91${mobile}`;

      const payload = {
        ver: "1.0",
        key: apiKey,
        encrpt: "0",
        messages: [
          {
            dest: [dest],
            text: message,
            send: senderId,
            type: "PM",
            dlt_entity_id: entityId,
          },
        ],
      };

      const response = await fetch("https://japi.instaalerts.zone/httpapi/JsonReceiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error("Karix HTTP error:", response.status, responseText);
        return res.status(502).json({ error: `SMS gateway returned HTTP ${response.status}` });
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error("Karix non-JSON response:", responseText);
        return res.status(502).json({ error: "SMS gateway returned an unexpected response" });
      }

      console.log("Karix SMS response:", JSON.stringify(result));

      if (result.status?.code === "200") {
        res.json({ success: true, ackid: result.ackid, message: "SMS sent successfully" });
      } else {
        res.status(400).json({
          success: false,
          error: result.status?.desc || "SMS delivery failed",
          details: result,
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("SMS send error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // ============ SUPER ADMIN - SMS TEMPLATES ============

  app.get("/api/superadmin/sms-templates", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllSmsTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMS templates" });
    }
  });

  app.post("/api/superadmin/sms-templates", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const result = insertSmsTemplateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid template data", details: result.error });
      }
      const template = await storage.createSmsTemplate(result.data);
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create SMS template" });
    }
  });

  app.put("/api/superadmin/sms-templates/:id", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const result = insertSmsTemplateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid template data", details: result.error });
      }
      const template = await storage.updateSmsTemplate(req.params.id, result.data);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update SMS template" });
    }
  });

  app.delete("/api/superadmin/sms-templates/:id", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteSmsTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SMS template" });
    }
  });

  return httpServer;
}
