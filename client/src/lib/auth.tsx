import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { Customer, Admin } from "@shared/schema";
import { setAdminSessionExpiredHandler } from "@/lib/queryClient";

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
  const [sessionExpired, setSessionExpired] = useState(false);
  const hasHandledExpiry = useRef(false);

  const logout = useCallback(() => {
    setAdmin(null);
    setToken(null);
    setSessionExpired(false);
    hasHandledExpiry.current = false;
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("adminToken");
    const storedAdmin = localStorage.getItem("admin");
    if (storedToken && storedAdmin) {
      setToken(storedToken);
      setAdmin(JSON.parse(storedAdmin));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setAdminSessionExpiredHandler(() => {
      if (!hasHandledExpiry.current) {
        hasHandledExpiry.current = true;
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");
        setToken(null);
        setAdmin(null);
        setSessionExpired(true);
      }
    });
    return () => setAdminSessionExpiredHandler(() => {});
  }, []);

  const login = (admin: Admin, token: string) => {
    setAdmin(admin);
    setToken(token);
    setSessionExpired(false);
    hasHandledExpiry.current = false;
    localStorage.setItem("adminToken", token);
    localStorage.setItem("admin", JSON.stringify(admin));
  };

  const handleSessionExpiredLogout = useCallback(() => {
    logout();
    window.location.href = "/admin/login";
  }, [logout]);

  return (
    <AdminAuthContext.Provider value={{ admin, token, login, logout, isLoading }}>
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" data-testid="dialog-session-expired">
          <div className="bg-background rounded-md shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold">Session Expired</h2>
            <p className="text-sm text-muted-foreground">
              Your admin session has expired or is no longer valid. Please log in again to continue.
            </p>
            <button
              onClick={handleSessionExpiredLogout}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
              data-testid="button-session-expired-login"
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
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
