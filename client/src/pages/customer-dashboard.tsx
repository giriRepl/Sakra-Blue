import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LogOut, Clock, CheckCircle, AlertCircle, ChevronRight, Package, User, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { LoadingPage } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCustomerAuth } from "@/lib/auth";
import type { PurchaseWithDetails, Redemption, Service, Member } from "@shared/schema";
import { format, differenceInDays, isPast } from "date-fns";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

interface PurchaseCardProps {
  purchase: PurchaseWithDetails;
}

function PurchaseCard({ purchase }: PurchaseCardProps) {
  const pkg = purchase.packageSnapshot;
  const expiryDate = new Date(purchase.expiryDate);
  const isExpired = isPast(expiryDate);
  const daysRemaining = differenceInDays(expiryDate, new Date());

  // Calculate total services and redeemed count
  const totalServices = pkg.services.reduce((sum, s) => sum + s.quantity, 0);
  const redeemedCount = purchase.redemptions?.length || 0;
  const remainingServices = Math.max(0, totalServices - redeemedCount);
  const progressPercent = totalServices > 0 ? ((totalServices - remainingServices) / totalServices) * 100 : 0;

  // Map redemptions by service ID
  const redemptionsByService: Record<string, Redemption[]> = {};
  (purchase.redemptions || []).forEach((r) => {
    if (!redemptionsByService[r.serviceId]) {
      redemptionsByService[r.serviceId] = [];
    }
    redemptionsByService[r.serviceId].push(r);
  });

  return (
    <Card className={isExpired ? "opacity-75" : ""} data-testid={`card-purchase-${purchase.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{pkg.title}</CardTitle>
            <CardDescription className="mt-1">
              Purchased {format(new Date(purchase.purchaseDate), "MMM d, yyyy")}
            </CardDescription>
          </div>
          {isExpired ? (
            <Badge variant="destructive" className="shrink-0">Expired</Badge>
          ) : daysRemaining <= 7 ? (
            <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              {daysRemaining} days left
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              {daysRemaining} days left
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Services Used</span>
            <span className="font-medium">{redeemedCount}/{totalServices}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Validity */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Valid until:</span>
          <span className="font-medium">{format(expiryDate, "MMM d, yyyy")}</span>
        </div>

        <Separator />

        {/* Services List */}
        <div>
          <h4 className="text-sm font-medium mb-3">Services</h4>
          <div className="space-y-3">
            {pkg.services.map((service: Service) => {
              const serviceRedemptions = redemptionsByService[service.id] || [];
              const usedCount = serviceRedemptions.length;
              const totalQty = service.quantity;
              const allUsed = usedCount >= totalQty;

              return (
                <div key={service.id} className="flex items-start gap-3" data-testid={`service-${service.id}`}>
                  <div className={`rounded-full p-1 mt-0.5 ${allUsed ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                    {allUsed ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${allUsed ? "line-through text-muted-foreground" : ""}`}>
                        {service.name}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {usedCount}/{totalQty}
                      </Badge>
                    </div>
                    {serviceRedemptions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last used: {format(new Date(serviceRedemptions[serviceRedemptions.length - 1].redeemedAt), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Members List */}
        {purchase.members && purchase.members.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Covered Members</h4>
              <div className="space-y-2">
                {purchase.members
                  .filter((m: Member) => m.type === "adult")
                  .map((member: Member) => (
                    <div key={member.id} className="flex items-center gap-3" data-testid={`member-${member.id}`}>
                      <div className="rounded-full bg-primary/10 p-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">Adult, {member.age} years</p>
                      </div>
                    </div>
                  ))}
                {purchase.members
                  .filter((m: Member) => m.type === "kid")
                  .map((member: Member) => (
                    <div key={member.id} className="flex items-center gap-3" data-testid={`member-${member.id}`}>
                      <div className="rounded-full bg-accent/50 p-1.5">
                        <Baby className="h-3.5 w-3.5 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">Kid, {member.age} years</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CustomerDashboardPage() {
  const [, navigate] = useLocation();
  const { customer, token, logout, isLoading: authLoading } = useCustomerAuth();

  const { data: purchases, isLoading } = useQuery<PurchaseWithDetails[]>({
    queryKey: ["/api/customers/purchases"],
    enabled: !!token,
  });

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!customer || !token) {
    navigate("/login");
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const activePurchases = purchases?.filter(p => !isPast(new Date(p.expiryDate))) || [];
  const expiredPurchases = purchases?.filter(p => isPast(new Date(p.expiryDate))) || [];

  return (
    <div className="min-h-screen bg-background" data-testid="page-customer-dashboard">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <span className="text-sm font-bold text-primary-foreground">S</span>
              </div>
              <span className="font-semibold">My Cards</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* User Info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <span className="text-lg font-semibold text-primary">
                  {customer.mobile.slice(-2)}
                </span>
              </div>
              <div>
                <p className="font-medium">+91 {customer.mobile}</p>
                <p className="text-sm text-muted-foreground">
                  {purchases?.length || 0} package{(purchases?.length || 0) !== 1 ? "s" : ""} purchased
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <LoadingPage />
        ) : purchases && purchases.length > 0 ? (
          <div className="space-y-8">
            {/* Active Purchases */}
            {activePurchases.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Active Packages
                </h2>
                <div className="space-y-4">
                  {activePurchases.map((purchase) => (
                    <PurchaseCard key={purchase.id} purchase={purchase} />
                  ))}
                </div>
              </div>
            )}

            {/* Expired Purchases */}
            {expiredPurchases.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Expired Packages</span>
                </h2>
                <div className="space-y-4">
                  {expiredPurchases.map((purchase) => (
                    <PurchaseCard key={purchase.id} purchase={purchase} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon="cart"
            title="No packages yet"
            description="You haven't purchased any health packages yet. Browse our packages to get started."
            action={
              <Button onClick={() => navigate("/")} data-testid="button-browse-packages">
                Browse Packages
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            }
          />
        )}
      </main>
    </div>
  );
}
