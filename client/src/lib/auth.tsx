import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Customer, Admin } from "@shared/schema";

interface CustomerAuthContextType {
  customer: Customer | null;
  token: string | null;
  login: (customer: Customer, token: string) => void;
  logout: () => void;
  refreshCustomer: () => void;
  isLoading: boolean;
}

interface AdminAuthContextType {
  admin: Admin | null;
  token: string | null;
  login: (admin: Admin, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);
const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("customerToken");
    const storedCustomer = localStorage.getItem("customer");
    if (storedToken && storedCustomer) {
      setToken(storedToken);
      setCustomer(JSON.parse(storedCustomer));
    }
    setIsLoading(false);
  }, []);

  const login = (customer: Customer, token: string) => {
    setCustomer(customer);
    setToken(token);
    localStorage.setItem("customerToken", token);
    localStorage.setItem("customer", JSON.stringify(customer));
  };

  const logout = () => {
    setCustomer(null);
    setToken(null);
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customer");
  };

  const refreshCustomer = () => {
    const storedCustomer = localStorage.getItem("customer");
    if (storedCustomer) {
      setCustomer(JSON.parse(storedCustomer));
    }
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, token, login, logout, refreshCustomer, isLoading }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("adminToken");
    const storedAdmin = localStorage.getItem("admin");
    if (storedToken && storedAdmin) {
      setToken(storedToken);
      setAdmin(JSON.parse(storedAdmin));
    }
    setIsLoading(false);
  }, []);

  const login = (admin: Admin, token: string) => {
    setAdmin(admin);
    setToken(token);
    localStorage.setItem("adminToken", token);
    localStorage.setItem("admin", JSON.stringify(admin));
  };

  const logout = () => {
    setAdmin(null);
    setToken(null);
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
  };

  return (
    <AdminAuthContext.Provider value={{ admin, token, login, logout, isLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
