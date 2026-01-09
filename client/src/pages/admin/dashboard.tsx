import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingCard } from "@/components/loading-spinner";
import { useAdminAuth } from "@/lib/auth";
import { LoadingPage } from "@/components/loading-spinner";
import type { DashboardStats } from "@shared/schema";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-full bg-primary/10 p-2">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">{value}</div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!token,
  });

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  return (
    <AdminLayout title="Dashboard">
      <div data-testid="page-admin-dashboard">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Overview of your healthcare package business
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : stats ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Live Packages"
              value={stats.livePackages}
              icon={<Package className="h-5 w-5 text-primary" />}
              description="Active packages available for purchase"
            />
            <StatCard
              title="Total Purchases"
              value={stats.totalPurchases}
              icon={<ShoppingCart className="h-5 w-5 text-primary" />}
              description="Packages sold to customers"
            />
            <StatCard
              title="Users with Redemptions"
              value={stats.usersWithRedemptions}
              icon={<Users className="h-5 w-5 text-primary" />}
              description="Customers who used at least one service"
            />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Live Packages"
              value={0}
              icon={<Package className="h-5 w-5 text-primary" />}
            />
            <StatCard
              title="Total Purchases"
              value={0}
              icon={<ShoppingCart className="h-5 w-5 text-primary" />}
            />
            <StatCard
              title="Users with Redemptions"
              value={0}
              icon={<Users className="h-5 w-5 text-primary" />}
            />
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card
                className="hover-elevate cursor-pointer"
                onClick={() => navigate("/admin/packages")}
                data-testid="card-quick-action-packages"
              >
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Packages</p>
                    <p className="text-sm text-muted-foreground">Create and edit health packages</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="hover-elevate cursor-pointer"
                onClick={() => navigate("/admin/redeem")}
                data-testid="card-quick-action-redeem"
              >
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Redeem Services</p>
                    <p className="text-sm text-muted-foreground">Process customer redemptions</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
