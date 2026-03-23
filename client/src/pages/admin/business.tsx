import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth } from "@/lib/auth";
import { LoadingPage } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  IndianRupee,
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Ban,
  LayoutDashboard,
  List,
} from "lucide-react";

type DatePreset = "today" | "7days" | "30days" | "custom";

function getPresetRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (preset === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (preset === "7days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (preset === "30days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  return { from: new Date(now.setHours(0, 0, 0, 0)), to };
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ────────────────────────────────────────────────
// Dashboard Tab
// ────────────────────────────────────────────────

function DashboardTab() {
  const [preset, setPreset] = useState<DatePreset>("30days");
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));

  const { from, to } = preset === "custom"
    ? { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") }
    : getPresetRange(preset);

  const { data, isLoading } = useQuery<{
    totalPurchases: number;
    totalRevenue: number;
    packageWise: { title: string; count: number; revenue: number }[];
    byStatus: Record<string, number>;
  }>({
    queryKey: ["/api/admin/business-dashboard", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/admin/business-dashboard?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const presetLabel: Record<DatePreset, string> = {
    today: "Today",
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    custom: "Custom",
  };

  return (
    <div className="space-y-6" data-testid="tab-dashboard">
      {/* Date range selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "7days", "30days", "custom"] as DatePreset[]).map((p) => (
              <Button
                key={p}
                variant={preset === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p)}
                data-testid={`button-preset-${p}`}
              >
                {presetLabel[p]}
              </Button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-40 text-sm"
                  data-testid="input-custom-from"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-40 text-sm"
                  data-testid="input-custom-to"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card data-testid="stat-card-total-purchases">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Purchases
                </CardTitle>
                <div className="rounded-full bg-primary/10 p-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{data?.totalPurchases ?? 0}</div>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-total-revenue">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <div className="rounded-full bg-primary/10 p-2">
                  <IndianRupee className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{formatINR(data?.totalRevenue ?? 0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Status breakdown */}
          {data?.byStatus && Object.keys(data.byStatus).length > 0 && (
            <Card data-testid="card-status-breakdown">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">By Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(data.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2">
                      <Badge
                        variant={
                          status === "captured" || status === "paid"
                            ? "default"
                            : status === "cancelled"
                            ? "destructive"
                            : "secondary"
                        }
                        data-testid={`badge-status-${status}`}
                      >
                        {status}
                      </Badge>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Package-wise breakdown */}
          {data?.packageWise && data.packageWise.length > 0 ? (
            <Card data-testid="card-package-breakdown">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Package-wise Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead className="text-right">Purchases</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.packageWise.map((pkg) => (
                      <TableRow key={pkg.title} data-testid={`row-pkg-${pkg.title}`}>
                        <TableCell className="font-medium">{pkg.title}</TableCell>
                        <TableCell className="text-right">{pkg.count}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatINR(pkg.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No purchases in the selected date range.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// All Purchases Tab
// ────────────────────────────────────────────────

function AllPurchasesTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [refundPasscode, setRefundPasscode] = useState("");
  const pageSize = 20;

  const { data, isLoading } = useQuery<{
    purchases: any[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/admin/all-purchases", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/all-purchases?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return res.json();
    },
  });

  const cancelRefundMutation = useMutation({
    mutationFn: async ({ purchaseId, passcode }: { purchaseId: string; passcode: string }) => {
      const res = await apiRequest("POST", `/api/admin/all-purchases/${purchaseId}/cancel-refund`, { passcode });
      const body = await res.json();
      return body;
    },
    onSuccess: (data) => {
      toast({
        title: "Plan Cancelled & Refund Initiated",
        description: `Refund of ${formatINR(data.amountRupees)} initiated. Refund ID: ${data.refundId}`,
      });
      setConfirmCancelId(null);
      setRefundPasscode("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-purchases"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testFlagMutation = useMutation({
    mutationFn: async ({ purchaseId, isTestTransaction }: { purchaseId: string; isTestTransaction: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/all-purchases/${purchaseId}/test-flag`, { isTestTransaction });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-purchases"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const purchasesList = data?.purchases ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const confirmPurchase = confirmCancelId
    ? purchasesList.find((p) => p.id === confirmCancelId)
    : null;

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }, []);

  return (
    <div className="space-y-4" data-testid="tab-all-purchases">
      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by mobile, receipt or payment ID…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="max-w-sm"
          data-testid="input-purchase-search"
        />
        <Button onClick={handleSearch} size="sm" data-testid="button-purchase-search">
          <Search className="h-4 w-4" />
        </Button>
        {search && (
          <Button
            onClick={handleClearSearch}
            variant="ghost"
            size="sm"
            data-testid="button-purchase-clear-search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {total > 0
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
            : "No purchases"}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : purchasesList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No purchases found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan (People)</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchasesList.map((p: any) => (
                  <TableRow key={p.id} data-testid={`row-purchase-${p.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {formatDate(p.purchaseDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {formatTime(p.purchaseDate)}
                    </TableCell>
                    <TableCell data-testid={`cell-mobile-${p.id}`}>{p.mobile}</TableCell>
                    <TableCell data-testid={`cell-name-${p.id}`}>{p.customerName}</TableCell>
                    <TableCell data-testid={`cell-plan-${p.id}`}>
                      {p.packageTitle}
                      {p.numPeople ? ` (${p.numPeople})` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.paymentSource === "internal"
                        ? <span className="text-muted-foreground italic">Internal</span>
                        : (p.razorpayReceipt || "–")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.paymentSource === "internal"
                        ? <span className="text-muted-foreground italic">Internal</span>
                        : (p.razorpayPaymentId || "–")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatINR(p.amountPaid)}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${p.id}`}>
                      <Badge
                        variant={
                          p.paymentStatus === "captured" || p.paymentStatus === "paid"
                            ? "default"
                            : p.paymentStatus === "cancelled"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {p.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          testFlagMutation.mutate({
                            purchaseId: p.id,
                            isTestTransaction: !p.isTestTransaction,
                          })
                        }
                        disabled={testFlagMutation.isPending}
                        className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                          p.isTestTransaction
                            ? "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-muted border-border text-muted-foreground hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                        }`}
                        data-testid={`button-test-flag-${p.id}`}
                      >
                        {p.isTestTransaction ? "Test ✓" : "Test"}
                      </button>
                    </TableCell>
                    <TableCell>
                      {(p.paymentStatus === "captured" || p.paymentStatus === "paid") &&
                        p.redemptionCount === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-white text-xs"
                            onClick={() => setConfirmCancelId(p.id)}
                            data-testid={`button-cancel-refund-${p.id}`}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Cancel & Refund
                          </Button>
                        )}
                      {p.paymentStatus === "cancelled" && p.razorpayRefundId && (
                        <span className="text-xs text-muted-foreground font-mono">
                          Refund: {p.razorpayRefundId}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 p-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  data-testid="button-purchases-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-purchases-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Cancel & Refund Dialog */}
      <Dialog
        open={!!confirmCancelId}
        onOpenChange={(open) => {
          if (!open) { setConfirmCancelId(null); setRefundPasscode(""); }
        }}
      >
        <DialogContent data-testid="dialog-cancel-refund">
          <DialogHeader>
            <DialogTitle className="text-destructive">Cancel & Refund</DialogTitle>
          </DialogHeader>
          {confirmPurchase && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Customer: </span>
                <span className="font-medium">{confirmPurchase.customerName}</span>{" "}
                ({confirmPurchase.mobile})
              </div>
              <div>
                <span className="text-muted-foreground">Plan: </span>
                <span className="font-medium">{confirmPurchase.packageTitle}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Amount to refund: </span>
                <span className="font-semibold text-destructive">
                  {formatINR(confirmPurchase.amountPaid)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Payment ID: </span>
                <span className="font-mono text-xs">{confirmPurchase.razorpayPaymentId}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                This will immediately cancel the plan and initiate a full refund via Razorpay.
              </p>
              <div className="pt-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Refund Passcode
                </label>
                <Input
                  type="password"
                  placeholder="Enter passcode to authorise refund"
                  value={refundPasscode}
                  onChange={(e) => setRefundPasscode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && refundPasscode && !cancelRefundMutation.isPending) {
                      cancelRefundMutation.mutate({ purchaseId: confirmCancelId!, passcode: refundPasscode });
                    }
                  }}
                  data-testid="input-refund-passcode"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setConfirmCancelId(null); setRefundPasscode(""); }}
              data-testid="button-cancel-dialog-cancel"
            >
              Go Back
            </Button>
            <Button
              variant="destructive"
              disabled={cancelRefundMutation.isPending || !refundPasscode}
              onClick={() => cancelRefundMutation.mutate({ purchaseId: confirmCancelId!, passcode: refundPasscode })}
              data-testid="button-confirm-refund"
            >
              {cancelRefundMutation.isPending ? "Processing…" : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────

type Tab = "dashboard" | "purchases";

export default function AdminBusinessPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  if (authLoading) return <LoadingPage />;

  return (
    <AdminLayout title="Business">
      <div className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 border-b" data-testid="business-tab-bar">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "dashboard"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-button-dashboard"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("purchases")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "purchases"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-button-purchases"
          >
            <List className="h-4 w-4" />
            All Purchases
          </button>
        </div>

        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "purchases" && <AllPurchasesTab />}
      </div>
    </AdminLayout>
  );
}
