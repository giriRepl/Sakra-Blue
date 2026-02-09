import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Edit, Clock, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingPage } from "@/components/loading-spinner";
import { useAdminAuth } from "@/lib/auth";
import type { Package } from "@shared/schema";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function PackageViewPage() {
  const [, params] = useRoute("/admin/packages/:id");
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();
  const packageId = params?.id;

  const { data: pkg, isLoading } = useQuery<Package>({
    queryKey: ["/api/packages", packageId],
    enabled: !!packageId && !!token,
  });

  if (authLoading || isLoading) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  if (!pkg) {
    return (
      <AdminLayout title="Package Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Package not found</p>
          <Button onClick={() => navigate("/admin/packages")}>
            Back to Packages
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Package Details">
      <div data-testid="page-package-view">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/packages")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Packages
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/packages/new?clone=${pkg.id}`)}
              data-testid="button-clone"
            >
              <Copy className="h-4 w-4 mr-2" />
              Clone
            </Button>
            {pkg.status === "draft" && (
              <Button
                onClick={() => navigate(`/admin/packages/${pkg.id}/edit`)}
                data-testid="button-edit"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Package
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{pkg.title}</CardTitle>
                    <p className="text-muted-foreground mt-2">{pkg.description}</p>
                  </div>
                  <Badge variant={pkg.status === "published" ? "default" : pkg.status === "deleted" ? "destructive" : "outline"}>
                    {pkg.status === "published" ? "Published" : pkg.status === "deleted" ? "Deleted" : "Draft"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{formatPrice(pkg.price)}</p>
                    <p className="text-sm text-muted-foreground">Price</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{pkg.validityMonths}</p>
                    <p className="text-sm text-muted-foreground">Months Validity</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{pkg.adultsCount}</p>
                    <p className="text-sm text-muted-foreground">Adults Covered</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{pkg.kidsCount}</p>
                    <p className="text-sm text-muted-foreground">Kids Covered</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{pkg.services.length}</p>
                    <p className="text-sm text-muted-foreground">Services</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle>Included Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pkg.services.map((service, index) => (
                    <div key={service.id}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{service.name}</p>
                            {service.type === "percentage" && service.percentage ? (
                              <Badge variant="outline">{service.percentage}% off</Badge>
                            ) : service.isUnlimited ? (
                              <Badge variant="outline">Unlimited</Badge>
                            ) : service.quantity > 1 ? (
                              <Badge variant="outline">x{service.quantity}</Badge>
                            ) : null}
                          </div>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={pkg.status === "published" ? "default" : pkg.status === "deleted" ? "destructive" : "outline"}>
                    {pkg.status === "published" ? "Published" : pkg.status === "deleted" ? "Deleted" : "Draft"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Validity</span>
                  <span className="font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {pkg.validityMonths} months
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Services</span>
                  <span className="font-medium">
                    {pkg.services.reduce((sum, s) => sum + s.quantity, 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {pkg.termsAndConditions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {pkg.termsAndConditions}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
