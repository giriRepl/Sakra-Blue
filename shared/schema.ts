import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Service type for package services
// type "quantity" = limited/unlimited number of uses (e.g., 5 OPD consultancies)
// type "percentage" = percentage discount (e.g., 10% off pharmacy)
export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["quantity", "percentage"]).default("quantity"),
  quantity: z.number().default(1),
  isUnlimited: z.boolean().default(false),
  percentage: z.number().min(0).max(100).optional(),
});

export type Service = z.infer<typeof serviceSchema>;

// Pricing tier schema - maps number of people to a price
export const pricingTierSchema = z.object({
  adultsCount: z.number().min(0),
  kidsCount: z.number().min(0),
  price: z.number().min(1),
});

export type PricingTier = z.infer<typeof pricingTierSchema>;

// Helper to get pricing tiers from a package (backward compat)
export function getPackagePricingTiers(pkg: { pricingTiers?: PricingTier[]; price: number; adultsCount: number; kidsCount: number }): PricingTier[] {
  if (pkg.pricingTiers && pkg.pricingTiers.length > 0) {
    return pkg.pricingTiers;
  }
  return [{ adultsCount: pkg.adultsCount, kidsCount: pkg.kidsCount, price: pkg.price }];
}

// Helper to get lowest price from a package
export function getLowestPrice(pkg: { pricingTiers?: PricingTier[]; price: number; adultsCount: number; kidsCount: number }): number {
  const tiers = getPackagePricingTiers(pkg);
  return Math.min(...tiers.map(t => t.price));
}

// Packages table - health service bundles
export const packages = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  services: jsonb("services").$type<Service[]>().notNull().default([]),
  validityMonths: integer("validity_months").notNull(),
  price: integer("price").notNull().default(0), // legacy - kept for backward compat
  adultsCount: integer("adults_count").notNull().default(1), // legacy
  kidsCount: integer("kids_count").notNull().default(0), // legacy
  pricingTiers: jsonb("pricing_tiers").$type<PricingTier[]>().notNull().default([]),
  termsAndConditions: text("terms_and_conditions"),
  isActive: boolean("is_active").notNull().default(true),
  isEnterprise: boolean("is_enterprise").notNull().default(false),
  status: text("status").notNull().default("draft"), // draft, published, deleted
  badge: text("badge"), // null, 'most_popular', 'best_value'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPackageSchema = createInsertSchema(packages, {
  services: z.array(serviceSchema),
  pricingTiers: z.array(pricingTierSchema),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

// Customers table - mobile number based auth
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mobile: text("mobile").notNull().unique(),
  name: text("name"),
  email: text("email"),
  age: integer("age"),
  location: text("location"),
  gender: text("gender"), // 'male', 'female', 'other'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  age: z.coerce.number().min(1, "Age must be positive"),
  location: z.string().min(1, "Location is required"),
  gender: z.enum(["male", "female", "other"]),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Purchases table - customer package purchases
export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  packageId: varchar("package_id").notNull().references(() => packages.id),
  packageSnapshot: jsonb("package_snapshot").$type<Package>().notNull(), // snapshot at time of purchase
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  amountPaid: integer("amount_paid").notNull(),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  paymentStatus: text("payment_status").notNull().default("pending"),
});

export const purchasesRelations = relations(purchases, ({ one }) => ({
  customer: one(customers, {
    fields: [purchases.customerId],
    references: [customers.id],
  }),
  package: one(packages, {
    fields: [purchases.packageId],
    references: [packages.id],
  }),
}));

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

// Redemptions table - service usage tracking
export const redemptions = pgTable("redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").notNull().references(() => purchases.id),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  redeemedBy: varchar("redeemed_by").notNull(), // admin email
});

export const redemptionsRelations = relations(redemptions, ({ one }) => ({
  purchase: one(purchases, {
    fields: [redemptions.purchaseId],
    references: [purchases.id],
  }),
}));

export const insertRedemptionSchema = createInsertSchema(redemptions).omit({
  id: true,
  redeemedAt: true,
});

export type InsertRedemption = z.infer<typeof insertRedemptionSchema>;
export type Redemption = typeof redemptions.$inferSelect;

// Admin users table
export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

// OTP sessions - persisted in database
export const otpSessions = pgTable("otp_sessions", {
  mobile: text("mobile").primaryKey(),
  otp: text("otp").notNull(),
  verified: boolean("verified").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
});

export type OtpSession = typeof otpSessions.$inferSelect;

// Admin sessions - persisted in database
export const adminSessions = pgTable("admin_sessions", {
  token: text("token").primaryKey(),
  adminId: varchar("admin_id").notNull(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Members table - covered individuals for a purchase
export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").notNull().references(() => purchases.id),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  type: text("type").notNull(), // 'adult' or 'kid'
  relation: text("relation"), // Relation to account holder (e.g., Spouse, Son, Self)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const membersRelations = relations(members, ({ one }) => ({
  purchase: one(purchases, {
    fields: [members.purchaseId],
    references: [purchases.id],
  }),
}));

export const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.number().min(0, "Age must be positive"),
  type: z.enum(["adult", "kid"]),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = {
  purchaseId: string;
  name: string;
  age: number;
  type: string;
  relation?: string;
};

// SMS Templates table
export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  text: text("text").notNull(),
  templateId: text("template_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export type SmsTemplate = typeof smsTemplates.$inferSelect;

// SMS Failure Logs table
export const smsFailureLogs = pgTable("sms_failure_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mobileLast4: text("mobile_last4").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSmsFailureLogSchema = createInsertSchema(smsFailureLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertSmsFailureLog = z.infer<typeof insertSmsFailureLogSchema>;
export type SmsFailureLog = typeof smsFailureLogs.$inferSelect;

// SMS Logs table - logs every SMS API call
export const smsLogs = pgTable("sms_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mobile: text("mobile").notNull(),
  message: text("message").notNull(),
  templateName: text("template_name"),
  templateId: text("template_id"),
  status: text("status").notNull(),
  apiResponse: text("api_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSmsLogSchema = createInsertSchema(smsLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertSmsLog = z.infer<typeof insertSmsLogSchema>;
export type SmsLog = typeof smsLogs.$inferSelect;

// Corporates table - corporate onboarding
export const corporates = pgTable("corporates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  packageId: varchar("package_id").notNull().references(() => packages.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const corporatesRelations = relations(corporates, ({ one }) => ({
  package: one(packages, {
    fields: [corporates.packageId],
    references: [packages.id],
  }),
}));

export const insertCorporateSchema = createInsertSchema(corporates).omit({
  id: true,
  createdAt: true,
});

export type InsertCorporate = z.infer<typeof insertCorporateSchema>;
export type Corporate = typeof corporates.$inferSelect;

// Corporate Employees table
export const corporateEmployees = pgTable("corporate_employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  corporateId: varchar("corporate_id").notNull().references(() => corporates.id),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email"),
  employeeId: text("employee_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const corporateEmployeesRelations = relations(corporateEmployees, ({ one }) => ({
  corporate: one(corporates, {
    fields: [corporateEmployees.corporateId],
    references: [corporates.id],
  }),
}));

export const insertCorporateEmployeeSchema = createInsertSchema(corporateEmployees).omit({
  id: true,
  createdAt: true,
});

export type InsertCorporateEmployee = z.infer<typeof insertCorporateEmployeeSchema>;
export type CorporateEmployee = typeof corporateEmployees.$inferSelect;

// Corporate with details
export type CorporateWithDetails = Corporate & {
  package: Package;
  employeeCount: number;
};

// Purchase with full details for API responses
export type PurchaseWithDetails = Purchase & {
  customer: Customer;
  package: Package;
  redemptions: Redemption[];
  members?: Member[];
};

// Dashboard stats type
export type DashboardStats = {
  livePackages: number;
  totalPurchases: number;
  usersWithRedemptions: number;
};
