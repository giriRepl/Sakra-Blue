import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Edit, Eye, Loader2, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingCard } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAdminAuth } from "@/lib/auth";
import { LoadingPage } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Package } from "@shared/schema";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

interface PackageCardProps {
  pkg: Package;
}

function PackageCard({ pkg }: PackageCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/packages/${pkg.id}/toggle`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({
        title: pkg.isActive ? "Package Deactivated" : "Package Activated",
        description: `${pkg.title} is now ${pkg.isActive ? "inactive" : "active"}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update package status.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className={`flex flex-col h-full ${!pkg.isActive ? "opacity-60" : ""}`} data-testid={`card-package-${pkg.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{pkg.title}</CardTitle>
            {pkg.isEnterprise && (
              <Badge variant="outline" className="w-fit text-xs" data-testid={`badge-enterprise-${pkg.id}`}>
                Enterprise
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={pkg.isActive}
              onCheckedChange={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              data-testid={`switch-active-${pkg.id}`}
            />
            {toggleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {pkg.description}
        </p>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="font-semibold">{formatPrice(pkg.price)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Validity</span>
            <span className="font-medium">{pkg.validityMonths} months</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Coverage</span>
            <span className="font-medium">{pkg.adultsCount} Adults, {pkg.kidsCount} Kids</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Services</span>
            <Badge variant="secondary">{pkg.services.length} services</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={pkg.isActive ? "default" : "outline"}>
              {pkg.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/admin/packages/${pkg.id}`)}
          data-testid={`button-view-${pkg.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/admin/packages/${pkg.id}/edit`)}
          data-testid={`button-edit-${pkg.id}`}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AdminPackagesPage() {
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
    enabled: !!token,
  });

  const consumerPackages = useMemo(
    () => (packages || []).filter((pkg) => !pkg.isEnterprise),
    [packages],
  );

  const corporatePackages = useMemo(
    () => (packages || []).filter((pkg) => pkg.isEnterprise),
    [packages],
  );

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  return (
    <AdminLayout title="Packages">
      <div data-testid="page-admin-packages">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <p className="text-muted-foreground">
            Manage your healthcare packages
          </p>
          <Button
            onClick={() => navigate("/admin/packages/new")}
            data-testid="button-create-package"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Package
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <LoadingCard />
              <LoadingCard />
            </div>
          </div>
        ) : packages && packages.length > 0 ? (
          <div className="space-y-10">
            <section data-testid="section-consumer-packages">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Consumer Packages</h2>
                <Badge variant="secondary">{consumerPackages.length}</Badge>
              </div>
              {consumerPackages.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {consumerPackages.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              ) : (
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground text-center" data-testid="text-no-consumer-packages">
                    No consumer packages yet. Create a package without the Enterprise flag.
                  </p>
                </Card>
              )}
            </section>

            <section data-testid="section-corporate-packages">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Corporate Packages</h2>
                <Badge variant="secondary">{corporatePackages.length}</Badge>
              </div>
              {corporatePackages.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {corporatePackages.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              ) : (
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground text-center" data-testid="text-no-corporate-packages">
                    No corporate packages yet. Create a package with the Enterprise flag enabled.
                  </p>
                </Card>
              )}
            </section>
          </div>
        ) : (
          <EmptyState
            icon="package"
            title="No packages yet"
            description="Create your first healthcare package to get started."
            action={
              <Button
                onClick={() => navigate("/admin/packages/new")}
                data-testid="button-create-first-package"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Package
              </Button>
            }
          />
        )}
      </div>
    </AdminLayout>
  );
}
