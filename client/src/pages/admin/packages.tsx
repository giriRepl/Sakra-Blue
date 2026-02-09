import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Edit, Eye, Loader2, Users, Building2, Copy, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingCard } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAdminAuth } from "@/lib/auth";
import { LoadingPage } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Package } from "@shared/schema";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "published":
      return <Badge data-testid="badge-status-published">Published</Badge>;
    case "deleted":
      return <Badge variant="destructive" data-testid="badge-status-deleted">Deleted</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-draft">Draft</Badge>;
  }
}

interface PackageCardProps {
  pkg: Package;
  showActions?: boolean;
}

function PackageCard({ pkg, showActions = true }: PackageCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/packages/${pkg.id}/publish`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({
        title: "Package Published",
        description: `"${pkg.title}" is now published and visible to customers.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to publish package.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/packages/${pkg.id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages/deleted"] });
      toast({
        title: "Package Deleted",
        description: `"${pkg.title}" has been moved to deleted.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete package.",
        variant: "destructive",
      });
    },
  });

  const isPublished = pkg.status === "published";
  const isDeleted = pkg.status === "deleted";
  const isDraft = pkg.status === "draft";

  return (
    <Card className={`flex flex-col h-full ${isDeleted ? "opacity-60" : ""}`} data-testid={`card-package-${pkg.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{pkg.title}</CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={pkg.status} />
              {pkg.isEnterprise && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-enterprise-${pkg.id}`}>
                  Enterprise
                </Badge>
              )}
            </div>
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
        </div>
      </CardContent>
      {showActions && (
        <CardFooter className="pt-4 border-t gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/admin/packages/${pkg.id}`)}
            data-testid={`button-view-${pkg.id}`}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {isDraft && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => navigate(`/admin/packages/${pkg.id}/edit`)}
              data-testid={`button-edit-${pkg.id}`}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/admin/packages/new?clone=${pkg.id}`)}
            data-testid={`button-clone-${pkg.id}`}
          >
            <Copy className="h-4 w-4 mr-1" />
            Clone
          </Button>
          {isDraft && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  disabled={publishMutation.isPending}
                  data-testid={`button-publish-${pkg.id}`}
                >
                  {publishMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Publish
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish Package</AlertDialogTitle>
                  <AlertDialogDescription>
                    Once published, this package will be visible to customers and can no longer be edited. Are you sure you want to publish "{pkg.title}"?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-publish">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => publishMutation.mutate()}
                    data-testid="button-confirm-publish"
                  >
                    Publish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isDeleted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${pkg.id}`}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Package</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move "{pkg.title}" to the deleted section. Existing purchases will not be affected. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function PackageSection({ title, icon: Icon, packages: pkgs, emptyMessage }: {
  title: string;
  icon: typeof Users;
  packages: Package[];
  emptyMessage: string;
}) {
  return (
    <section data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}-packages`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="secondary">{pkgs.length}</Badge>
      </div>
      {pkgs.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {pkgs.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground text-center">
            {emptyMessage}
          </p>
        </Card>
      )}
    </section>
  );
}

export default function AdminPackagesPage() {
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState("active");

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
    enabled: !!token,
  });

  const { data: deletedPackages, isLoading: deletedLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages/deleted"],
    enabled: !!token && activeTab === "deleted",
  });

  const consumerPackages = useMemo(
    () => (packages || []).filter((pkg) => !pkg.isEnterprise),
    [packages],
  );

  const corporatePackages = useMemo(
    () => (packages || []).filter((pkg) => pkg.isEnterprise),
    [packages],
  );

  const deletedConsumerPackages = useMemo(
    () => (deletedPackages || []).filter((pkg) => !pkg.isEnterprise),
    [deletedPackages],
  );

  const deletedCorporatePackages = useMemo(
    () => (deletedPackages || []).filter((pkg) => pkg.isEnterprise),
    [deletedPackages],
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList data-testid="tabs-package-status">
            <TabsTrigger value="active" data-testid="tab-active">
              Active
              {packages && <Badge variant="secondary" className="ml-2">{packages.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="deleted" data-testid="tab-deleted">
              Deleted
              {deletedPackages && <Badge variant="secondary" className="ml-2">{deletedPackages.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-10">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                <LoadingCard />
                <LoadingCard />
              </div>
            ) : packages && packages.length > 0 ? (
              <>
                <PackageSection
                  title="Consumer"
                  icon={Users}
                  packages={consumerPackages}
                  emptyMessage="No consumer packages yet. Create a package without the Enterprise flag."
                />
                <PackageSection
                  title="Corporate"
                  icon={Building2}
                  packages={corporatePackages}
                  emptyMessage="No corporate packages yet. Create a package with the Enterprise flag enabled."
                />
              </>
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
          </TabsContent>

          <TabsContent value="deleted" className="space-y-10">
            {deletedLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                <LoadingCard />
                <LoadingCard />
              </div>
            ) : deletedPackages && deletedPackages.length > 0 ? (
              <>
                <PackageSection
                  title="Consumer"
                  icon={Users}
                  packages={deletedConsumerPackages}
                  emptyMessage="No deleted consumer packages."
                />
                <PackageSection
                  title="Corporate"
                  icon={Building2}
                  packages={deletedCorporatePackages}
                  emptyMessage="No deleted corporate packages."
                />
              </>
            ) : (
              <EmptyState
                icon="package"
                title="No deleted packages"
                description="Deleted packages will appear here."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
