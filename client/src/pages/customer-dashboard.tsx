import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogOut, Clock, CheckCircle, AlertCircle, ChevronRight, Package, User, Baby, Edit, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LoadingPage } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";

import { useCustomerAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PurchaseWithDetails, Redemption, Service, Member } from "@shared/schema";
import { format, differenceInDays, isPast } from "date-fns";

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(1, "Age must be positive"),
  location: z.string().min(1, "Location is required"),
  gender: z.enum(["male", "female", "other"], { required_error: "Please select your gender" }),
});

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

  // Calculate total services and redeemed count (only count quantity-based limited services)
  const quantityServices = pkg.services.filter((s) => (s.type || "quantity") === "quantity" && !s.isUnlimited);
  const totalServices = quantityServices.reduce((sum, s) => sum + s.quantity, 0);
  const redeemedCount = (purchase.redemptions || []).filter((r) => {
    const svc = pkg.services.find((s) => s.id === r.serviceId);
    return svc && (svc.type || "quantity") === "quantity" && !svc.isUnlimited;
  }).length;
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
              const svcType = service.type || "quantity";
              const isUnlimited = service.isUnlimited || false;
              const totalQty = service.quantity;
              const allUsed = svcType === "quantity" && !isUnlimited && usedCount >= totalQty;

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
                      {svcType === "percentage" && service.percentage ? (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {service.percentage}% off
                        </Badge>
                      ) : isUnlimited ? (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {usedCount} used
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {totalQty - usedCount} Remaining (out of {totalQty})
                        </Badge>
                      )}
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
  const { customer, token, logout, isLoading: authLoading, refreshCustomer } = useCustomerAuth();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: customer?.name || "",
      age: customer?.age || 30,
      location: customer?.location || "",
      gender: (customer?.gender as "male" | "female" | "other") || undefined,
    },
  });

  const { data: purchases, isLoading } = useQuery<PurchaseWithDetails[]>({
    queryKey: ["/api/customers/purchases"],
    enabled: !!token,
  });

  const profileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileFormSchema>) => {
      const res = await apiRequest("POST", "/api/customers/profile", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      // Refresh customer data in local storage
      if (customer) {
        const updatedCustomer = { ...customer, ...data };
        localStorage.setItem("customer", JSON.stringify(updatedCustomer));
        refreshCustomer();
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditProfile = () => {
    profileForm.reset({
      name: customer?.name || "",
      age: customer?.age || 30,
      location: customer?.location || "",
      gender: (customer?.gender as "male" | "female" | "other") || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleProfileSubmit = (data: z.infer<typeof profileFormSchema>) => {
    profileMutation.mutate(data);
  };

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
        {/* User Profile */}
        <Card className="mb-6" data-testid="card-user-profile">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                My Profile
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditProfile}
                data-testid="button-edit-profile"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <span className="text-lg font-semibold text-primary">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : customer.mobile.slice(-2)}
                </span>
              </div>
              <div>
                <p className="font-medium">{customer.name || "Name not set"}</p>
                <p className="text-sm text-muted-foreground">+91 {customer.mobile}</p>
              </div>
            </div>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Age</p>
                <p className="font-medium">{customer.age ? `${customer.age} years` : "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Location</p>
                <p className="font-medium flex items-center gap-1">
                  {customer.location ? (
                    <>
                      <MapPin className="h-3.5 w-3.5" />
                      {customer.location}
                    </>
                  ) : (
                    "Not set"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Gender</p>
                <p className="font-medium capitalize">{customer.gender || "Not set"}</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {purchases?.length || 0} package{(purchases?.length || 0) !== 1 ? "s" : ""} purchased
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your personal information
              </DialogDescription>
            </DialogHeader>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Your full name" data-testid="input-edit-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={1} placeholder="Your age" data-testid="input-edit-age" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="City, State" data-testid="input-edit-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-gender">
                            <SelectValue placeholder="Select your gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={profileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {profileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

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
