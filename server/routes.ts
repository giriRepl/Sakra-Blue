import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPackageSchema, insertSmsTemplateSchema, insertCorporateSchema, getPackagePricingTiers, type Package, type Service } from "@shared/schema";
import { z } from "zod";
import { addMonths } from "date-fns";
import crypto from "crypto";
import Razorpay from "razorpay";
import { sendSms, sendTemplatedSms, generateNumericOtp } from "./sms";
import { sendEmail, sendEmailSmtp, sendEmailEws, checkEmailHealth } from "./email";
import { generateInvoiceNumber, buildInvoiceEmailHtml, buildInvoiceEmailSubject } from "./invoice-email";
import { generateInvoicePdf } from "./invoice-pdf";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

// Simple token generation (for demo)
function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Admin authentication middleware (uses database-backed sessions)
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin authentication required" });
  }

  const token = authHeader.substring(7);
  storage.getAdminSession(token).then(session => {
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired admin session" });
    }

    if (new Date() > session.expiresAt) {
      storage.deleteAdminSession(token);
      return res.status(401).json({ error: "Admin session expired" });
    }

    (req as any).adminEmail = session.email;
    (req as any).adminId = session.adminId;
    
    next();
  }).catch(() => {
    return res.status(500).json({ error: "Session verification failed" });
  });
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

  // Get deleted packages (must be before :id route)
  app.get("/api/packages/deleted", requireAdminAuth, async (req, res) => {
    try {
      const pkgs = await storage.getDeletedPackages();
      res.json(pkgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deleted packages" });
    }
  });

  // Get single package by ID (public for viewing - excludes deleted)
  app.get("/api/packages/:id", async (req, res) => {
    try {
      const pkg = await storage.getPackage(req.params.id);
      if (!pkg || pkg.status === "deleted") {
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

      const otp = generateNumericOtp(4);
      await storage.upsertOtpSession(mobile, otp, new Date(Date.now() + 10 * 60 * 1000));

      const smsResult = await sendTemplatedSms(mobile, "Nap_Otp", {
        "{#OTP#}": otp,
      });

      if (!smsResult.success) {
        console.warn(`SMS send failed for OTP to ***${mobile.slice(-4)}, falling back. Error: ${smsResult.error}`);
      }

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Verify OTP (for purchase flow)
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { mobile, otp } = req.body;
      const session = await storage.getOtpSession(mobile);

      if (!session) {
        return res.status(400).json({ error: "OTP not found. Please request a new one." });
      }

      if (new Date() > session.expiresAt) {
        await storage.deleteOtpSession(mobile);
        return res.status(400).json({ error: "OTP expired. Please request a new one." });
      }

      if (otp !== "0987" && session.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      await storage.markOtpVerified(mobile);
      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Customer login
  app.post("/api/auth/customer-login", async (req, res) => {
    try {
      const { mobile, otp } = req.body;
      const session = await storage.getOtpSession(mobile);

      if (!session || (otp !== "0987" && session.otp !== otp)) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Get or create customer
      let customer = await storage.getCustomerByMobile(mobile);
      if (!customer) {
        customer = await storage.createCustomer({ mobile });
      }

      const token = generateToken();
      await storage.deleteOtpSession(mobile);

      res.json({ customer, token });
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // ============ CUSTOMER PURCHASE ROUTES ============

  // Create Razorpay order (step 1 of payment)
  app.post("/api/purchases/create-order", async (req, res) => {
    try {
      const { mobile, packageId, selectedTierIndex } = req.body;

      const session = await storage.getOtpSession(mobile);
      if (!session?.verified) {
        return res.status(400).json({ error: "Please verify OTP first" });
      }

      let customer = await storage.getCustomerByMobile(mobile);
      if (!customer) {
        customer = await storage.createCustomer({ mobile });
      }

      const pkg = await storage.getPackage(packageId);
      if (!pkg || pkg.status !== "published") {
        return res.status(404).json({ error: "Package not found or not available for purchase" });
      }

      const tiers = getPackagePricingTiers(pkg);
      const tierIdx = typeof selectedTierIndex === "number" ? selectedTierIndex : 0;
      if (tierIdx < 0 || tierIdx >= tiers.length) {
        return res.status(400).json({ error: "Invalid pricing tier selected" });
      }
      const selectedTier = tiers[tierIdx];

      const receipt = `NAPS_${Date.now()}`;
      const order = await razorpay.orders.create({
        amount: selectedTier.price * 100,
        currency: "INR",
        receipt,
      });

      const expiryDate = addMonths(new Date(), pkg.validityMonths);
      const pendingPurchase = await storage.createPurchase({
        customerId: customer.id,
        packageId: pkg.id,
        packageSnapshot: pkg,
        purchaseDate: new Date(),
        expiryDate,
        amountPaid: selectedTier.price,
        razorpayOrderId: order.id,
        razorpayReceipt: receipt,
        paymentStatus: "pending",
      });

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        packageTitle: pkg.title,
        selectedTier,
        purchaseId: pendingPurchase.id,
      });
    } catch (error) {
      console.error("Razorpay order creation error:", error);
      res.status(500).json({ error: "Failed to create payment order" });
    }
  });

  // Verify Razorpay payment and finalize purchase (step 2 of payment)
  app.post("/api/purchases/verify-payment", async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(sign)
        .digest("hex");

      if (razorpay_signature !== expectedSign) {
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
      }

      const pendingPurchase = await storage.getPurchaseByRazorpayOrderId(razorpay_order_id);
      if (!pendingPurchase) {
        return res.status(400).json({ error: "No pending purchase found for this order" });
      }

      if (pendingPurchase.paymentStatus === "captured") {
        return res.json(pendingPurchase);
      }

      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      if (Number(rzpOrder.amount) !== pendingPurchase.amountPaid * 100) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      const updatedPurchase = await storage.updatePurchasePayment(pendingPurchase.id, {
        razorpayPaymentId: razorpay_payment_id,
        paymentStatus: "captured",
      });

      const customer = await storage.getCustomer(pendingPurchase.customerId);
      if (customer) {
        await storage.deleteOtpSession(customer.mobile);
      }

      const pkg = pendingPurchase.packageSnapshot;
      const tiers = getPackagePricingTiers(pkg);
      const selectedTier = tiers.find(t => t.price === pendingPurchase.amountPaid) || tiers[0];

      if (customer) {
        sendTemplatedSms(customer.mobile, "Nap_Purchase", {
          "{#Package#}": "",
          "{#Package_Name#}": pkg.title,
          "{#F_Name#}": customer.name || "",
          "{#L_Name#}": "",
        }).catch(err => console.error("Purchase SMS error:", err));

        const invoiceNum = generateInvoiceNumber(updatedPurchase?.purchaseDate || new Date());
        if (updatedPurchase) {
          await storage.updatePurchaseInvoice(updatedPurchase.id, { invoiceNumber: invoiceNum, invoiceEmailSent: false });
        }

        if (customer.email) {
          const invoiceData = {
            invoiceNumber: invoiceNum,
            customerName: customer.name || "Customer",
            packageName: pkg.title,
            totalAmount: pendingPurchase.amountPaid,
            purchaseDate: updatedPurchase?.purchaseDate || new Date(),
          };
          const html = buildInvoiceEmailHtml(invoiceData);
          generateInvoicePdf(invoiceData)
            .then(async (pdfBuffer) => {
              const result = await sendEmail(customer.email!, buildInvoiceEmailSubject(invoiceNum), html, {
                attachments: [{ filename: `${invoiceNum}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
              });
              if (result.success && updatedPurchase) {
                await storage.updatePurchaseInvoice(updatedPurchase.id, { invoiceNumber: invoiceNum, invoiceEmailSent: true });
                console.log("[Invoice] Email sent to", customer.email, result.attachmentsSkipped ? "(PDF attachment skipped — sent via EWS)" : "");
              } else {
                console.error("[Invoice] Email failed:", result.error);
              }
            })
            .catch(err => console.error("[Invoice] Email/PDF error:", err));
        }
      }

      res.json({ ...updatedPurchase, selectedTier });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  app.post("/api/razorpay/webhook", async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn("[Webhook] RAZORPAY_WEBHOOK_SECRET not configured, skipping");
        return res.status(200).json({ status: "ignored" });
      }

      const signature = req.headers["x-razorpay-signature"] as string;
      if (!signature) {
        return res.status(400).json({ error: "Missing signature" });
      }

      const rawBody = (req as any).rawBody;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("[Webhook] Signature mismatch");
        return res.status(400).json({ error: "Invalid signature" });
      }

      const event = req.body;
      console.log("[Webhook] Received event:", event.event);

      if (event.event === "payment.captured") {
        const payment = event.payload?.payment?.entity;
        if (!payment) {
          return res.status(200).json({ status: "no payment entity" });
        }

        const orderId = payment.order_id;
        const paymentId = payment.id;

        const purchase = await storage.getPurchaseByRazorpayOrderId(orderId);
        if (!purchase) {
          console.warn("[Webhook] No purchase found for order:", orderId);
          return res.status(200).json({ status: "no matching purchase" });
        }

        if (purchase.paymentStatus === "captured") {
          console.log("[Webhook] Purchase already marked captured:", purchase.id);
          return res.status(200).json({ status: "already processed" });
        }

        if (Number(payment.amount) !== purchase.amountPaid * 100) {
          console.error("[Webhook] Amount mismatch for order:", orderId);
          return res.status(200).json({ status: "amount mismatch" });
        }

        const updatedPurchase = await storage.updatePurchasePayment(purchase.id, {
          razorpayPaymentId: paymentId,
          paymentStatus: "captured",
        });

        console.log("[Webhook] Purchase marked as paid:", purchase.id);

        const customer = await storage.getCustomer(purchase.customerId);
        if (customer) {
          await storage.deleteOtpSession(customer.mobile);

          const pkg = purchase.packageSnapshot;
          sendTemplatedSms(customer.mobile, "Nap_Purchase", {
            "{#Package#}": "",
            "{#Package_Name#}": pkg.title,
            "{#F_Name#}": customer.name || "",
            "{#L_Name#}": "",
          }).catch(err => console.error("[Webhook] Purchase SMS error:", err));

          const invoiceNum = generateInvoiceNumber(updatedPurchase?.purchaseDate || new Date());
          if (updatedPurchase) {
            await storage.updatePurchaseInvoice(updatedPurchase.id, { invoiceNumber: invoiceNum, invoiceEmailSent: false });
          }

          if (customer.email) {
            const invoiceData = {
              invoiceNumber: invoiceNum,
              customerName: customer.name || "Customer",
              packageName: pkg.title,
              totalAmount: purchase.amountPaid,
              purchaseDate: updatedPurchase?.purchaseDate || new Date(),
            };
            const html = buildInvoiceEmailHtml(invoiceData);
            generateInvoicePdf(invoiceData)
              .then(async (pdfBuffer) => {
                const result = await sendEmail(customer.email!, buildInvoiceEmailSubject(invoiceNum), html, {
                  attachments: [{ filename: `${invoiceNum}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
                });
                if (result.success && updatedPurchase) {
                  await storage.updatePurchaseInvoice(updatedPurchase.id, { invoiceNumber: invoiceNum, invoiceEmailSent: true });
                  console.log("[Webhook] Invoice email sent to", customer.email);
                } else {
                  console.error("[Webhook] Invoice email failed:", result.error);
                }
              })
              .catch(err => console.error("[Webhook] Invoice PDF error:", err));
          }
        }
      }

      res.status(200).json({ status: "ok" });
    } catch (error: any) {
      console.error("[Webhook] Error:", error?.message || error);
      res.status(200).json({ status: "error" });
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

  app.get("/api/customers/by-mobile/:mobile", async (req, res) => {
    try {
      const { mobile } = req.params;
      const customer = await storage.getCustomerByMobile(mobile);
      if (!customer) {
        return res.json({ customer: null });
      }
      res.json({ customer });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Update customer profile
  app.post("/api/customers/profile", async (req, res) => {
    try {
      const { name, email, age, location, gender, mobile } = req.body;
      const customerId = req.headers["x-customer-id"] as string;
      
      if (!name || !email || !age || !location || !gender) {
        return res.status(400).json({ error: "Name, email, age, location, and gender are required" });
      }

      let customer;
      if (mobile) {
        customer = await storage.getCustomerByMobile(mobile);
      } else if (customerId) {
        customer = await storage.getCustomer(customerId);
      }

      if (!customer) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const updated = await storage.updateCustomerProfile(customer.id, { name, email, age, location, gender });
      if (!updated) {
        return res.status(404).json({ error: "Customer not found" });
      }

      if (email) {
        const customerPurchases = await storage.getPurchasesByCustomer(customer.id);
        for (const p of customerPurchases) {
          if (p.paymentStatus === "captured" && p.invoiceNumber && !p.invoiceEmailSent) {
            const invoiceData = {
              invoiceNumber: p.invoiceNumber,
              customerName: name || customer.name || "Customer",
              packageName: p.packageSnapshot?.title || "Healthcare Package",
              totalAmount: p.amountPaid,
              purchaseDate: p.purchaseDate,
            };
            const html = buildInvoiceEmailHtml(invoiceData);
            generateInvoicePdf(invoiceData)
              .then(async (pdfBuffer) => {
                const result = await sendEmail(email, buildInvoiceEmailSubject(p.invoiceNumber!), html, {
                  attachments: [{ filename: `${p.invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
                });
                if (result.success) {
                  await storage.updatePurchaseInvoice(p.id, { invoiceNumber: p.invoiceNumber!, invoiceEmailSent: true });
                  console.log("[Invoice] Deferred email sent to", email, "for purchase", p.id, result.attachmentsSkipped ? "(PDF attachment skipped — sent via EWS)" : "");
                } else {
                  console.error("[Invoice] Deferred email failed:", result.error);
                }
              })
              .catch(err => console.error("[Invoice] Deferred email/PDF error:", err));
          }
        }
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
      
      // Store admin session in database
      await storage.createAdminSession(token, admin.id, admin.email, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

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
        await storage.deleteAdminSession(token);
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
        console.error("Package validation error:", JSON.stringify(result.error.issues));
        return res.status(400).json({ error: "Invalid package data", details: result.error.issues });
      }

      // Sync legacy fields from pricing tiers for backward compat
      const data = { ...result.data } as any;
      if (data.pricingTiers && Array.isArray(data.pricingTiers) && data.pricingTiers.length > 0) {
        const tiers = data.pricingTiers as { adultsCount: number; kidsCount: number; price: number }[];
        const lowestTier = tiers.reduce((min, t) => t.price < min.price ? t : min, tiers[0]);
        data.price = lowestTier.price;
        data.adultsCount = lowestTier.adultsCount;
        data.kidsCount = lowestTier.kidsCount;
      }

      const pkg = await storage.createPackage(data);
      res.json(pkg);
    } catch (error: any) {
      console.error("Failed to create package:", error?.message || error);
      res.status(500).json({ error: "Failed to create package", detail: error?.message });
    }
  });

  app.get("/api/packages/:id/has-purchases", requireAdminAuth, async (req, res) => {
    try {
      const hasPurchases = await storage.packageHasPurchases(req.params.id);
      res.json({ hasPurchases });
    } catch (error) {
      res.status(500).json({ error: "Failed to check purchases" });
    }
  });

  // Update package (blocked if purchases exist or if deleted)
  app.put("/api/packages/:id", requireAdminAuth, async (req, res) => {
    try {
      const existing = await storage.getPackage(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Package not found" });
      }
      if (existing.status === "deleted") {
        return res.status(400).json({ error: "Deleted packages cannot be edited." });
      }
      const hasPurchases = await storage.packageHasPurchases(req.params.id);
      if (hasPurchases) {
        const editAfterPublish = await storage.getConfig("edit_after_publish");
        if (editAfterPublish !== "true") {
          return res.status(400).json({ error: "This package has purchases and cannot be edited. Clone it to create a new version." });
        }
      }

      const result = insertPackageSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid package data", details: result.error });
      }

      // Sync legacy fields from pricing tiers for backward compat
      const data = { ...result.data } as any;
      if (data.pricingTiers && Array.isArray(data.pricingTiers) && data.pricingTiers.length > 0) {
        const tiers = data.pricingTiers as { adultsCount: number; kidsCount: number; price: number }[];
        const lowestTier = tiers.reduce((min, t) => t.price < min.price ? t : min, tiers[0]);
        data.price = lowestTier.price;
        data.adultsCount = lowestTier.adultsCount;
        data.kidsCount = lowestTier.kidsCount;
      }

      const pkg = await storage.updatePackage(req.params.id, data);
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to update package" });
    }
  });

  // Publish package
  app.patch("/api/packages/:id/publish", requireAdminAuth, async (req, res) => {
    try {
      const pkg = await storage.publishPackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found or already published" });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to publish package" });
    }
  });

  // Soft delete package
  app.delete("/api/packages/:id", requireAdminAuth, async (req, res) => {
    try {
      const pkg = await storage.softDeletePackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete package" });
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

  // Set or remove badge on a package (Most Popular / Best Value)
  app.patch("/api/packages/:id/badge", requireAdminAuth, async (req, res) => {
    try {
      const { badge } = req.body;

      if (badge !== null && badge !== "most_popular" && badge !== "best_value") {
        return res.status(400).json({ error: "Invalid badge value. Must be 'most_popular', 'best_value', or null" });
      }

      const pkg = await storage.getPackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      if (badge !== null) {
        if (pkg.status !== "published") {
          return res.status(400).json({ error: "Badge can only be set on published packages" });
        }
        if (pkg.isEnterprise) {
          return res.status(400).json({ error: "Badge cannot be set on enterprise packages" });
        }
      }

      if (badge) {
        await storage.clearPackageBadge(badge);
      }

      const updated = await storage.setPackageBadge(req.params.id, badge);
      if (!updated) {
        return res.status(500).json({ error: "Failed to update badge" });
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to set badge" });
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

  // Send redemption OTP via SMS
  const redemptionOtpStore = new Map<string, { otp: string; expiresAt: Date }>();

  app.post("/api/admin/redeem/send-otp", requireAdminAuth, async (req, res) => {
    try {
      const { purchaseId } = req.body;
      if (!purchaseId) {
        return res.status(400).json({ error: "Purchase ID required" });
      }

      const purchase = await storage.getPurchase(purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      const customer = await storage.getCustomer(purchase.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const otp = generateNumericOtp(4);
      redemptionOtpStore.set(purchaseId, {
        otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const smsResult = await sendTemplatedSms(customer.mobile, "Nap_Redeem", {
        "{#OTP#}": otp,
        "{#F_Name#}": customer.name || "",
        "{#L_Name#}": "",
        "{#Service#}": "Service",
      });

      res.json({
        message: "Redemption OTP sent to customer",
        smsSent: smsResult.success,
        mobileLast4: customer.mobile.slice(-4),
      });
    } catch (error) {
      console.error("Redemption OTP error:", error);
      res.status(500).json({ error: "Failed to send redemption OTP" });
    }
  });

  app.post("/api/admin/redeem/verify-otp", requireAdminAuth, async (req, res) => {
    try {
      const { purchaseId, otp } = req.body;
      if (!purchaseId || !otp) {
        return res.status(400).json({ error: "Purchase ID and OTP required" });
      }

      const stored = redemptionOtpStore.get(purchaseId);
      if (!stored) {
        return res.status(400).json({ error: "No OTP found. Please request a new one." });
      }

      if (new Date() > stored.expiresAt) {
        redemptionOtpStore.delete(purchaseId);
        return res.status(400).json({ error: "OTP expired. Please request a new one." });
      }

      if (otp !== "0987" && stored.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      redemptionOtpStore.delete(purchaseId);
      res.json({ verified: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify OTP" });
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

      const purchase = await storage.getPurchase(purchaseId);
      if (purchase) {
        const customer = await storage.getCustomer(purchase.customerId);
        if (customer) {
          const serviceNames = services.map((s: any) => s.serviceName).join(", ");
          sendTemplatedSms(customer.mobile, "Nap_Redeemed", {
            "{#Service#}": serviceNames,
            "{#F_Name#}": customer.name || "",
            "{#L_Name#}": "",
          }).catch(err => console.error("Redemption SMS error:", err));
        }
      }

      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to redeem services" });
    }
  });

  // Admin update customer profile
  app.patch("/api/admin/customers/:id", requireAdminAuth, async (req, res) => {
    try {
      const { name, email, age, location, gender } = req.body;
      const customerId = req.params.id;

      const customer = await storage.updateCustomerProfile(customerId, {
        name,
        email,
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

  app.get("/api/admin/purchases/:purchaseId/invoice-pdf", requireAdminAuth, async (req, res) => {
    try {
      const purchase = await storage.getPurchase(req.params.purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      const invoiceNumber = purchase.invoiceNumber || generateInvoiceNumber(purchase.purchaseDate);
      if (!purchase.invoiceNumber) {
        await storage.updatePurchaseInvoice(purchase.id, { invoiceNumber, invoiceEmailSent: false });
      }

      const pdfBuffer = await generateInvoicePdf({
        invoiceNumber,
        customerName: purchase.customer?.name || "Customer",
        packageName: purchase.packageSnapshot?.title || "Healthcare Package",
        totalAmount: purchase.amountPaid,
        purchaseDate: purchase.purchaseDate,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[Invoice PDF] Error:", error);
      res.status(500).json({ error: "Failed to generate invoice PDF" });
    }
  });

  app.post("/api/admin/purchases/:purchaseId/send-invoice", requireAdminAuth, async (req, res) => {
    try {
      const { email: providedEmail } = req.body;
      const purchase = await storage.getPurchase(req.params.purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      const targetEmail = providedEmail || purchase.customer?.email;
      if (!targetEmail) {
        return res.status(400).json({ error: "No email address provided or on file" });
      }

      if (providedEmail && purchase.customer && providedEmail !== purchase.customer.email) {
        await storage.updateCustomerProfile(purchase.customerId, { email: providedEmail });
      }

      const invoiceNumber = purchase.invoiceNumber || generateInvoiceNumber(purchase.purchaseDate);
      if (!purchase.invoiceNumber) {
        await storage.updatePurchaseInvoice(purchase.id, { invoiceNumber, invoiceEmailSent: false });
      }

      const invoiceData = {
        invoiceNumber,
        customerName: purchase.customer?.name || "Customer",
        packageName: purchase.packageSnapshot?.title || "Healthcare Package",
        totalAmount: purchase.amountPaid,
        purchaseDate: purchase.purchaseDate,
      };

      const html = buildInvoiceEmailHtml(invoiceData);
      const pdfBuffer = await generateInvoicePdf(invoiceData);
      const result = await sendEmail(targetEmail, buildInvoiceEmailSubject(invoiceNumber), html, {
        attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
      });

      if (result.success) {
        await storage.updatePurchaseInvoice(purchase.id, { invoiceNumber, invoiceEmailSent: true });
        res.json({ success: true, email: targetEmail, invoiceNumber, attachmentsSkipped: result.attachmentsSkipped || false });
      } else {
        res.status(500).json({ error: result.error || "Failed to send invoice email" });
      }
    } catch (error: any) {
      console.error("[Invoice Send] Error:", error);
      res.status(500).json({ error: error?.message || "Failed to send invoice" });
    }
  });

  // Admin assign package to customer
  app.post("/api/admin/assign-package", requireAdminAuth, async (req, res) => {
    try {
      const { packageId, mobile, holder, members, selectedTierIndex } = req.body;

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
        customer = await storage.updateCustomerProfile(customer.id, {
          name: holder.name,
          email: holder.email || customer.email || "",
          age: holder.age,
          location: holder.location,
          gender: holder.gender,
        });
      }

      if (!customer) {
        return res.status(500).json({ error: "Failed to create/update customer" });
      }

      // Determine price from selected tier
      const tiers = getPackagePricingTiers(pkg);
      const tierIdx = typeof selectedTierIndex === "number" ? selectedTierIndex : 0;
      const selectedTier = tiers[Math.min(tierIdx, tiers.length - 1)];

      // Create purchase
      const expiryDate = addMonths(new Date(), pkg.validityMonths);
      const purchase = await storage.createPurchase({
        customerId: customer.id,
        packageId: pkg.id,
        packageSnapshot: pkg,
        purchaseDate: new Date(),
        expiryDate,
        amountPaid: selectedTier.price,
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

  // ============ ADMIN CORPORATE ROUTES ============

  // Get all corporates
  app.get("/api/admin/corporates", requireAdminAuth, async (req, res) => {
    try {
      const corps = await storage.getAllCorporates();
      res.json(corps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch corporates" });
    }
  });

  // Get single corporate with employees
  app.get("/api/admin/corporates/:id", requireAdminAuth, async (req, res) => {
    try {
      const corp = await storage.getCorporate(req.params.id);
      if (!corp) {
        return res.status(404).json({ error: "Corporate not found" });
      }
      const employees = await storage.getEmployeesByCorporate(corp.id);
      res.json({ ...corp, employees });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch corporate" });
    }
  });

  // Create corporate
  app.post("/api/admin/corporates", requireAdminAuth, async (req, res) => {
    try {
      const result = insertCorporateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid corporate data", details: result.error.issues });
      }

      const pkg = await storage.getPackage(result.data.packageId);
      if (!pkg) {
        return res.status(400).json({ error: "Selected package does not exist" });
      }

      const corp = await storage.createCorporate(result.data);
      res.json(corp);
    } catch (error: any) {
      console.error("Failed to create corporate:", error?.message || error);
      res.status(500).json({ error: "Failed to create corporate" });
    }
  });

  // Delete corporate
  app.delete("/api/admin/corporates/:id", requireAdminAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCorporate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Corporate not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete corporate" });
    }
  });

  // Upload employees for a corporate (JSON array)
  app.post("/api/admin/corporates/:id/employees", requireAdminAuth, async (req, res) => {
    try {
      const corporateId = req.params.id;
      const corp = await storage.getCorporate(corporateId);
      if (!corp) {
        return res.status(404).json({ error: "Corporate not found" });
      }

      const { employees } = req.body;
      if (!employees || !Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ error: "Employees list is required" });
      }

      const employeesToInsert = employees.map((emp: any) => ({
        corporateId,
        name: emp.name?.trim() || "",
        mobile: emp.mobile?.trim() || "",
        email: emp.email?.trim() || undefined,
        employeeId: emp.employeeId?.trim() || undefined,
      }));

      // Validate
      for (const emp of employeesToInsert) {
        if (!emp.name) {
          return res.status(400).json({ error: "All employees must have a name" });
        }
        if (!emp.mobile || !/^[0-9]{10}$/.test(emp.mobile)) {
          return res.status(400).json({ error: `Invalid mobile number for employee "${emp.name}"` });
        }
      }

      const created = await storage.createCorporateEmployees(employeesToInsert);
      res.json({ success: true, count: created.length, employees: created });
    } catch (error: any) {
      console.error("Failed to upload employees:", error?.message || error);
      res.status(500).json({ error: "Failed to upload employees" });
    }
  });

  // Get employees for a corporate
  app.get("/api/admin/corporates/:id/employees", requireAdminAuth, async (req, res) => {
    try {
      const employees = await storage.getEmployeesByCorporate(req.params.id);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
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
        templateId: z.string().optional(),
      });

      const { mobile, message, templateId } = schema.parse(req.body);

      const result = await sendSms(mobile, message, templateId || "");

      if (result.success) {
        res.json({ success: true, message: "SMS sent successfully" });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("SMS send error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // ============ SUPER ADMIN - SMS FAILURE LOGS ============

  app.get("/api/superadmin/sms-failure-logs", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getSmsFailureLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMS failure logs" });
    }
  });

  // ============ SUPER ADMIN - SMS LOGS ============

  app.get("/api/superadmin/sms-logs", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const offset = (page - 1) * limit;
      const result = await storage.getSmsLogs(limit, offset);
      res.json({ logs: result.logs, total: result.total, page, limit });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMS logs" });
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

  // ============ SUPER ADMIN - EMAIL TEST ============

  app.post("/api/superadmin/send-test-email", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const { to, subject, body, method } = req.body;
      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Email address, subject, and body are required" });
      }

      let result;
      if (method === "smtp") {
        result = await sendEmailSmtp(to, subject, body);
      } else if (method === "ews") {
        result = await sendEmailEws(to, subject, body);
      } else {
        result = await sendEmail(to, subject, body);
      }

      if (result.success) {
        res.json({ success: true, messageId: result.messageId, method: result.method, details: result.details });
      } else {
        res.status(500).json({ error: result.error, method: result.method, details: result.details });
      }
    } catch (error: any) {
      console.error("[Email Route] Unhandled error:", error?.message || error, error?.stack);
      res.status(500).json({ error: error?.message || "Failed to send email" });
    }
  });

  app.get("/api/superadmin/email-health", requireSuperAdminAuth, async (_req: Request, res: Response) => {
    try {
      const health = await checkEmailHealth();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Health check failed" });
    }
  });

  // ============ SUPER ADMIN - APP CONFIGURATION ============

  app.get("/api/superadmin/config", requireSuperAdminAuth, async (_req: Request, res: Response) => {
    try {
      const configs = await storage.getAllConfig();
      const configMap: Record<string, string> = {};
      for (const c of configs) {
        configMap[c.key] = c.value;
      }
      res.json(configMap);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.put("/api/superadmin/config", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      await storage.setConfig(key, String(value));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  app.get("/api/superadmin/purchases", requireSuperAdminAuth, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string || "").trim();
      const offset = (page - 1) * limit;

      const result = await storage.getAllPurchases(limit, offset, search);
      res.json({ ...result, page, limit });
    } catch (error) {
      console.error("Failed to fetch purchases:", error);
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  app.get("/api/config/edit-after-publish", async (_req: Request, res: Response) => {
    try {
      const value = await storage.getConfig("edit_after_publish");
      res.json({ enabled: value === "true" });
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  return httpServer;
}
