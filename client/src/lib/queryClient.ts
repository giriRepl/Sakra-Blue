import { QueryClient, QueryFunction } from "@tanstack/react-query";

let onAdminSessionExpired: (() => void) | null = null;

export function setAdminSessionExpiredHandler(handler: () => void) {
  onAdminSessionExpired = handler;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401 && getAdminToken()) {
      onAdminSessionExpired?.();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getCustomerId(): string | null {
  try {
    const customer = localStorage.getItem("customer");
    if (customer) {
      return JSON.parse(customer).id;
    }
  } catch {}
  return null;
}

function getAdminToken(): string | null {
  try {
    return localStorage.getItem("adminToken");
  } catch {}
  return null;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  const customerId = getCustomerId();
  if (customerId) {
    headers["x-customer-id"] = customerId;
  }
  
  const adminToken = getAdminToken();
  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
