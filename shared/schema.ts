import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Service type for package services
export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quantity: z.number().default(1),
});

export type Service = z.infer<typeof serviceSchema>;

// Packages table - health service bundles
export const packages = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  services: jsonb("services").$type<Service[]>().notNull().default([]),
  validityDays: integer("validity_days").notNull(),
  price: integer("price").notNull(), // in paise/cents
  termsAndConditions: text("terms_and_conditions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPackageSchema = createInsertSchema(packages).omit({
  id: true,
  createdAt: true,
});

export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

// Customers table - mobile number based auth
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mobile: text("mobile").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
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

// OTP sessions (in-memory for now, but defined for type safety)
export const otpSessionSchema = z.object({
  mobile: z.string(),
  otp: z.string(),
  expiresAt: z.date(),
  verified: z.boolean().default(false),
});

export type OtpSession = z.infer<typeof otpSessionSchema>;

// Purchase with full details for API responses
export type PurchaseWithDetails = Purchase & {
  customer: Customer;
  package: Package;
  redemptions: Redemption[];
};

// Dashboard stats type
export type DashboardStats = {
  livePackages: number;
  totalPurchases: number;
  usersWithRedemptions: number;
};
