import {
  packages,
  customers,
  purchases,
  redemptions,
  admins,
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
  type PurchaseWithDetails,
  type DashboardStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Packages
  getAllPackages(): Promise<Package[]>;
  getActivePackages(): Promise<Package[]>;
  getPackage(id: string): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: string, pkg: Partial<InsertPackage>): Promise<Package | undefined>;
  togglePackageActive(id: string): Promise<Package | undefined>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByMobile(mobile: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  // Purchases
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  getPurchasesByCustomer(customerId: string): Promise<PurchaseWithDetails[]>;
  getPurchasesByMobile(mobile: string): Promise<PurchaseWithDetails[]>;
  getPurchase(id: string): Promise<PurchaseWithDetails | undefined>;

  // Redemptions
  createRedemption(redemption: InsertRedemption): Promise<Redemption>;
  getRedemptionsByPurchase(purchaseId: string): Promise<Redemption[]>;

  // Admins
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;

  // Stats
  getDashboardStats(): Promise<DashboardStats>;
}

export class DatabaseStorage implements IStorage {
  // Packages
  async getAllPackages(): Promise<Package[]> {
    return db.select().from(packages).orderBy(desc(packages.createdAt));
  }

  async getActivePackages(): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.isActive, true)).orderBy(desc(packages.createdAt));
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

  // Purchases
  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [created] = await db.insert(purchases).values(purchase as any).returning();
    return created;
  }

  async getPurchasesByCustomer(customerId: string): Promise<PurchaseWithDetails[]> {
    const purchaseList = await db
      .select()
      .from(purchases)
      .where(eq(purchases.customerId, customerId))
      .orderBy(desc(purchases.purchaseDate));

    const result: PurchaseWithDetails[] = [];
    for (const purchase of purchaseList) {
      const purchaseRedemptions = await this.getRedemptionsByPurchase(purchase.id);
      const customer = await this.getCustomer(purchase.customerId);
      const pkg = await this.getPackage(purchase.packageId);
      
      if (customer && pkg) {
        result.push({
          ...purchase,
          customer,
          package: pkg,
          redemptions: purchaseRedemptions,
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
    const customer = await this.getCustomer(purchase.customerId);
    const pkg = await this.getPackage(purchase.packageId);

    if (!customer || !pkg) return undefined;

    return {
      ...purchase,
      customer,
      package: pkg,
      redemptions: purchaseRedemptions,
    };
  }

  // Redemptions
  async createRedemption(redemption: InsertRedemption): Promise<Redemption> {
    const [created] = await db.insert(redemptions).values(redemption).returning();
    return created;
  }

  async getRedemptionsByPurchase(purchaseId: string): Promise<Redemption[]> {
    return db.select().from(redemptions).where(eq(redemptions.purchaseId, purchaseId)).orderBy(desc(redemptions.redeemedAt));
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

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const activePackages = await db.select().from(packages).where(eq(packages.isActive, true));
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
