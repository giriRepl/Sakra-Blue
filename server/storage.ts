import {
  packages,
  customers,
  purchases,
  redemptions,
  admins,
  members,
  smsTemplates,
  corporates,
  corporateEmployees,
  otpSessions,
  adminSessions,
  type Package,
  type InsertPackage,
  type Customer,
  type InsertCustomer,
  type Purchase,
  type InsertPurchase,
  type Redemption,
  type InsertRedemption,
  type Admin,
  type InsertAdmin,
  type Member,
  type InsertMember,
  type SmsTemplate,
  type InsertSmsTemplate,
  type Corporate,
  type InsertCorporate,
  type CorporateEmployee,
  type InsertCorporateEmployee,
  type CorporateWithDetails,
  type PurchaseWithDetails,
  type DashboardStats,
  type OtpSession,
  smsFailureLogs,
  type SmsFailureLog,
  type InsertSmsFailureLog,
  smsLogs,
  type SmsLog,
  type InsertSmsLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, ne } from "drizzle-orm";

export interface IStorage {
  // Packages
  getAllPackages(): Promise<Package[]>;
  getDeletedPackages(): Promise<Package[]>;
  getActivePackages(): Promise<Package[]>;
  getPackage(id: string): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: string, pkg: Partial<InsertPackage>): Promise<Package | undefined>;
  togglePackageActive(id: string): Promise<Package | undefined>;
  publishPackage(id: string): Promise<Package | undefined>;
  softDeletePackage(id: string): Promise<Package | undefined>;
  setPackageBadge(id: string, badge: string | null): Promise<Package | undefined>;
  clearPackageBadge(badge: string): Promise<void>;
  packageHasPurchases(id: string): Promise<boolean>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByMobile(mobile: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomerProfile(id: string, profile: { name: string; email: string; age: number; location: string; gender: string }): Promise<Customer | undefined>;

  // Purchases
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  getPurchasesByCustomer(customerId: string): Promise<PurchaseWithDetails[]>;
  getPurchasesByMobile(mobile: string): Promise<PurchaseWithDetails[]>;
  getPurchase(id: string): Promise<PurchaseWithDetails | undefined>;
  getPurchaseByRazorpayOrderId(orderId: string): Promise<Purchase | undefined>;
  updatePurchasePayment(id: string, data: { razorpayPaymentId: string; paymentStatus: string }): Promise<Purchase | undefined>;

  // Redemptions
  createRedemption(redemption: InsertRedemption): Promise<Redemption>;
  getRedemptionsByPurchase(purchaseId: string): Promise<Redemption[]>;

  // Members
  createMember(member: InsertMember): Promise<Member>;
  getMembersByPurchase(purchaseId: string): Promise<Member[]>;
  createMembersForPurchase(purchaseId: string, membersList: Omit<InsertMember, 'purchaseId'>[]): Promise<Member[]>;

  // Admins
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;

  // SMS Templates
  getAllSmsTemplates(): Promise<SmsTemplate[]>;
  getSmsTemplate(id: string): Promise<SmsTemplate | undefined>;
  getSmsTemplateByName(name: string): Promise<SmsTemplate | undefined>;
  createSmsTemplate(template: InsertSmsTemplate): Promise<SmsTemplate>;
  updateSmsTemplate(id: string, template: Partial<InsertSmsTemplate>): Promise<SmsTemplate | undefined>;
  deleteSmsTemplate(id: string): Promise<boolean>;

  // Corporates
  getAllCorporates(): Promise<CorporateWithDetails[]>;
  getCorporate(id: string): Promise<CorporateWithDetails | undefined>;
  createCorporate(corporate: InsertCorporate): Promise<Corporate>;
  deleteCorporate(id: string): Promise<boolean>;
  getEmployeesByCorporate(corporateId: string): Promise<CorporateEmployee[]>;
  createCorporateEmployees(employees: InsertCorporateEmployee[]): Promise<CorporateEmployee[]>;
  deleteEmployeesByCorporate(corporateId: string): Promise<void>;

  // SMS Failure Logs
  createSmsFailureLog(log: InsertSmsFailureLog): Promise<SmsFailureLog>;
  getSmsFailureLogs(): Promise<SmsFailureLog[]>;

  // SMS Logs
  createSmsLog(log: InsertSmsLog): Promise<SmsLog>;
  getSmsLogs(limit: number, offset: number): Promise<{ logs: SmsLog[]; total: number }>;

  // OTP Sessions
  upsertOtpSession(mobile: string, otp: string, expiresAt: Date): Promise<void>;
  getOtpSession(mobile: string): Promise<OtpSession | undefined>;
  markOtpVerified(mobile: string): Promise<void>;
  deleteOtpSession(mobile: string): Promise<void>;

  // Admin Sessions
  createAdminSession(token: string, adminId: string, email: string, expiresAt: Date): Promise<void>;
  getAdminSession(token: string): Promise<{ adminId: string; email: string; expiresAt: Date } | undefined>;
  deleteAdminSession(token: string): Promise<void>;

  // Stats
  getDashboardStats(): Promise<DashboardStats>;
}

export class DatabaseStorage implements IStorage {
  // Packages
  async getAllPackages(): Promise<Package[]> {
    return db.select().from(packages).where(ne(packages.status, "deleted")).orderBy(desc(packages.createdAt));
  }

  async getDeletedPackages(): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.status, "deleted")).orderBy(desc(packages.createdAt));
  }

  async getActivePackages(): Promise<Package[]> {
    return db.select().from(packages).where(
      and(eq(packages.status, "published"), eq(packages.isEnterprise, false))
    ).orderBy(desc(packages.createdAt));
  }

  async getPackage(id: string): Promise<Package | undefined> {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, id));
    return pkg || undefined;
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    const [created] = await db.insert(packages).values(pkg as any).returning();
    return created;
  }

  async updatePackage(id: string, pkg: Partial<InsertPackage>): Promise<Package | undefined> {
    const [updated] = await db.update(packages).set(pkg as any).where(eq(packages.id, id)).returning();
    return updated || undefined;
  }

  async togglePackageActive(id: string): Promise<Package | undefined> {
    const existing = await this.getPackage(id);
    if (!existing) return undefined;
    const [updated] = await db
      .update(packages)
      .set({ isActive: !existing.isActive })
      .where(eq(packages.id, id))
      .returning();
    return updated || undefined;
  }

  async publishPackage(id: string): Promise<Package | undefined> {
    const existing = await this.getPackage(id);
    if (!existing || existing.status !== "draft") return undefined;
    const [updated] = await db
      .update(packages)
      .set({ status: "published", isActive: true })
      .where(eq(packages.id, id))
      .returning();
    return updated || undefined;
  }

  async softDeletePackage(id: string): Promise<Package | undefined> {
    const existing = await this.getPackage(id);
    if (!existing || existing.status === "deleted") return undefined;
    const [updated] = await db
      .update(packages)
      .set({ status: "deleted", isActive: false, badge: null })
      .where(eq(packages.id, id))
      .returning();
    return updated || undefined;
  }

  async setPackageBadge(id: string, badge: string | null): Promise<Package | undefined> {
    const [updated] = await db
      .update(packages)
      .set({ badge })
      .where(eq(packages.id, id))
      .returning();
    return updated || undefined;
  }

  async clearPackageBadge(badge: string): Promise<void> {
    await db
      .update(packages)
      .set({ badge: null })
      .where(eq(packages.badge, badge));
  }

  async packageHasPurchases(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchases)
      .where(and(eq(purchases.packageId, id), eq(purchases.paymentStatus, "paid")));
    return (result[0]?.count ?? 0) > 0;
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByMobile(mobile: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.mobile, mobile));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async updateCustomerProfile(id: string, profile: { name: string; email: string; age: number; location: string; gender: string }): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set(profile)
      .where(eq(customers.id, id))
      .returning();
    return updated || undefined;
  }

  // Purchases
  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [created] = await db.insert(purchases).values(purchase as any).returning();
    return created;
  }

  async getPurchasesByCustomer(customerId: string): Promise<PurchaseWithDetails[]> {
    const purchaseList = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.customerId, customerId), eq(purchases.paymentStatus, "paid")))
      .orderBy(desc(purchases.purchaseDate));

    const result: PurchaseWithDetails[] = [];
    for (const purchase of purchaseList) {
      const purchaseRedemptions = await this.getRedemptionsByPurchase(purchase.id);
      const purchaseMembers = await this.getMembersByPurchase(purchase.id);
      const customer = await this.getCustomer(purchase.customerId);
      const pkg = await this.getPackage(purchase.packageId);
      
      if (customer && pkg) {
        result.push({
          ...purchase,
          customer,
          package: pkg,
          redemptions: purchaseRedemptions,
          members: purchaseMembers,
        });
      }
    }
    return result;
  }

  async getPurchasesByMobile(mobile: string): Promise<PurchaseWithDetails[]> {
    const customer = await this.getCustomerByMobile(mobile);
    if (!customer) return [];
    return this.getPurchasesByCustomer(customer.id);
  }

  async getPurchase(id: string): Promise<PurchaseWithDetails | undefined> {
    const [purchase] = await db.select().from(purchases).where(eq(purchases.id, id));
    if (!purchase) return undefined;

    const purchaseRedemptions = await this.getRedemptionsByPurchase(purchase.id);
    const purchaseMembers = await this.getMembersByPurchase(purchase.id);
    const customer = await this.getCustomer(purchase.customerId);
    const pkg = await this.getPackage(purchase.packageId);

    if (!customer || !pkg) return undefined;

    return {
      ...purchase,
      customer,
      package: pkg,
      redemptions: purchaseRedemptions,
      members: purchaseMembers,
    };
  }

  async getPurchaseByRazorpayOrderId(orderId: string): Promise<Purchase | undefined> {
    const [purchase] = await db.select().from(purchases).where(eq(purchases.razorpayOrderId, orderId));
    return purchase;
  }

  async updatePurchasePayment(id: string, data: { razorpayPaymentId: string; paymentStatus: string }): Promise<Purchase | undefined> {
    const [updated] = await db.update(purchases)
      .set({ razorpayPaymentId: data.razorpayPaymentId, paymentStatus: data.paymentStatus })
      .where(eq(purchases.id, id))
      .returning();
    return updated;
  }

  // Redemptions
  async createRedemption(redemption: InsertRedemption): Promise<Redemption> {
    const [created] = await db.insert(redemptions).values(redemption).returning();
    return created;
  }

  async getRedemptionsByPurchase(purchaseId: string): Promise<Redemption[]> {
    return db.select().from(redemptions).where(eq(redemptions.purchaseId, purchaseId)).orderBy(desc(redemptions.redeemedAt));
  }

  // Members
  async createMember(member: InsertMember): Promise<Member> {
    const [created] = await db.insert(members).values(member).returning();
    return created;
  }

  async getMembersByPurchase(purchaseId: string): Promise<Member[]> {
    return db.select().from(members).where(eq(members.purchaseId, purchaseId)).orderBy(members.type, members.name);
  }

  async createMembersForPurchase(purchaseId: string, membersList: Omit<InsertMember, 'purchaseId'>[]): Promise<Member[]> {
    if (membersList.length === 0) return [];
    const membersToInsert = membersList.map(m => ({ ...m, purchaseId }));
    const created = await db.insert(members).values(membersToInsert).returning();
    return created;
  }

  // Admins
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin || undefined;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [created] = await db.insert(admins).values(admin).returning();
    return created;
  }

  // SMS Templates
  async getAllSmsTemplates(): Promise<SmsTemplate[]> {
    return db.select().from(smsTemplates).orderBy(desc(smsTemplates.createdAt));
  }

  async getSmsTemplate(id: string): Promise<SmsTemplate | undefined> {
    const [template] = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id));
    return template || undefined;
  }

  async getSmsTemplateByName(name: string): Promise<SmsTemplate | undefined> {
    const [template] = await db.select().from(smsTemplates).where(eq(smsTemplates.name, name));
    return template || undefined;
  }

  async createSmsTemplate(template: InsertSmsTemplate): Promise<SmsTemplate> {
    const [created] = await db.insert(smsTemplates).values(template).returning();
    return created;
  }

  async updateSmsTemplate(id: string, template: Partial<InsertSmsTemplate>): Promise<SmsTemplate | undefined> {
    const [updated] = await db.update(smsTemplates).set(template).where(eq(smsTemplates.id, id)).returning();
    return updated || undefined;
  }

  async deleteSmsTemplate(id: string): Promise<boolean> {
    const result = await db.delete(smsTemplates).where(eq(smsTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Corporates
  async getAllCorporates(): Promise<CorporateWithDetails[]> {
    const corporateList = await db.select().from(corporates).orderBy(desc(corporates.createdAt));
    const result: CorporateWithDetails[] = [];
    for (const corp of corporateList) {
      const pkg = await this.getPackage(corp.packageId);
      const empCount = await db.select({ count: sql<number>`count(*)::int` }).from(corporateEmployees).where(eq(corporateEmployees.corporateId, corp.id));
      if (pkg) {
        result.push({ ...corp, package: pkg, employeeCount: empCount[0]?.count || 0 });
      }
    }
    return result;
  }

  async getCorporate(id: string): Promise<CorporateWithDetails | undefined> {
    const [corp] = await db.select().from(corporates).where(eq(corporates.id, id));
    if (!corp) return undefined;
    const pkg = await this.getPackage(corp.packageId);
    if (!pkg) return undefined;
    const empCount = await db.select({ count: sql<number>`count(*)::int` }).from(corporateEmployees).where(eq(corporateEmployees.corporateId, corp.id));
    return { ...corp, package: pkg, employeeCount: empCount[0]?.count || 0 };
  }

  async createCorporate(corporate: InsertCorporate): Promise<Corporate> {
    const [created] = await db.insert(corporates).values(corporate).returning();
    return created;
  }

  async deleteCorporate(id: string): Promise<boolean> {
    await db.delete(corporateEmployees).where(eq(corporateEmployees.corporateId, id));
    const result = await db.delete(corporates).where(eq(corporates.id, id)).returning();
    return result.length > 0;
  }

  async getEmployeesByCorporate(corporateId: string): Promise<CorporateEmployee[]> {
    return db.select().from(corporateEmployees).where(eq(corporateEmployees.corporateId, corporateId)).orderBy(corporateEmployees.name);
  }

  async createCorporateEmployees(employees: InsertCorporateEmployee[]): Promise<CorporateEmployee[]> {
    if (employees.length === 0) return [];
    const created = await db.insert(corporateEmployees).values(employees).returning();
    return created;
  }

  async deleteEmployeesByCorporate(corporateId: string): Promise<void> {
    await db.delete(corporateEmployees).where(eq(corporateEmployees.corporateId, corporateId));
  }

  // SMS Failure Logs
  async createSmsFailureLog(log: InsertSmsFailureLog): Promise<SmsFailureLog> {
    const [created] = await db.insert(smsFailureLogs).values(log).returning();
    return created;
  }

  async getSmsFailureLogs(): Promise<SmsFailureLog[]> {
    return db.select().from(smsFailureLogs).orderBy(desc(smsFailureLogs.createdAt));
  }

  // SMS Logs
  async createSmsLog(log: InsertSmsLog): Promise<SmsLog> {
    const [created] = await db.insert(smsLogs).values(log).returning();
    return created;
  }

  async getSmsLogs(limit: number, offset: number): Promise<{ logs: SmsLog[]; total: number }> {
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(smsLogs);
    const logs = await db.select().from(smsLogs).orderBy(desc(smsLogs.createdAt)).limit(limit).offset(offset);
    return { logs, total: countResult.count };
  }

  // OTP Sessions
  async upsertOtpSession(mobile: string, otp: string, expiresAt: Date): Promise<void> {
    await db.insert(otpSessions).values({ mobile, otp, verified: false, expiresAt })
      .onConflictDoUpdate({ target: otpSessions.mobile, set: { otp, verified: false, expiresAt } });
  }

  async getOtpSession(mobile: string): Promise<OtpSession | undefined> {
    const [session] = await db.select().from(otpSessions).where(eq(otpSessions.mobile, mobile));
    return session || undefined;
  }

  async markOtpVerified(mobile: string): Promise<void> {
    await db.update(otpSessions).set({ verified: true }).where(eq(otpSessions.mobile, mobile));
  }

  async deleteOtpSession(mobile: string): Promise<void> {
    await db.delete(otpSessions).where(eq(otpSessions.mobile, mobile));
  }

  // Admin Sessions
  async createAdminSession(token: string, adminId: string, email: string, expiresAt: Date): Promise<void> {
    await db.insert(adminSessions).values({ token, adminId, email, expiresAt });
  }

  async getAdminSession(token: string): Promise<{ adminId: string; email: string; expiresAt: Date } | undefined> {
    const [session] = await db.select().from(adminSessions).where(eq(adminSessions.token, token));
    return session || undefined;
  }

  async deleteAdminSession(token: string): Promise<void> {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const activePackages = await db.select().from(packages).where(eq(packages.status, "published"));
    const allPurchases = await db.select().from(purchases);
    
    // Get unique customers who have at least one redemption
    const customersWithRedemptions = await db
      .select({ customerId: purchases.customerId })
      .from(purchases)
      .innerJoin(redemptions, eq(purchases.id, redemptions.purchaseId))
      .groupBy(purchases.customerId);

    return {
      livePackages: activePackages.length,
      totalPurchases: allPurchases.length,
      usersWithRedemptions: customersWithRedemptions.length,
    };
  }
}

export const storage = new DatabaseStorage();
