import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, CheckCircle, Loader2, Package, Calendar, Phone, User, MapPin, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingCard, LoadingPage } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAdminAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PurchaseWithDetails, Service, Redemption, Customer } from "@shared/schema";
import { format, isPast, differenceInDays } from "date-fns";

const customerProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(1, "Age must be positive"),
  location: z.string().min(1, "Location is required"),
  gender: z.enum(["male", "female", "other"], { required_error: "Please select gender" }),
});

interface ServiceToRedeem {
  serviceId: string;
  serviceName: string;
}

export default function AdminRedeemPage() {
  const [, navigate] = useLocation();
  const { token, admin, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();

  const [mobile, setMobile] = useState("");
  const [searchMobile, setSearchMobile] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithDetails | null>(null);
  const [selectedServices, setSelectedServices] = useState<ServiceToRedeem[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const profileForm = useForm<z.infer<typeof customerProfileSchema>>({
    resolver: zodResolver(customerProfileSchema),
    defaultValues: {
      name: "",
      age: 30,
      location: "",
      gender: undefined,
    },
  });

  const { data: purchases, isLoading: purchasesLoading, refetch } = useQuery<PurchaseWithDetails[]>({
    queryKey: ["/api/admin/purchases", searchMobile],
    enabled: !!token && searchMobile.length === 10,
  });

  const redeemMutation = useMutation({
    mutationFn: async (data: { purchaseId: string; services: ServiceToRedeem[] }) => {
      const res = await apiRequest("POST", "/api/admin/redeem", {
        ...data,
        redeemedBy: admin?.email,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Services Redeemed",
        description: "The selected services have been marked as redeemed.",
      });
      setSelectedServices([]);
      setSelectedPurchase(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases", searchMobile] });
      refetch();
    },
    onError: () => {
      toast({
        title: "Redemption Failed",
        description: "Failed to redeem services. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customerProfileSchema> & { customerId: string }) => {
      const { customerId, ...profileData } = data;
      const res = await apiRequest("PATCH", `/api/admin/customers/${customerId}`, profileData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Customer profile has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases", searchMobile] });
      refetch();
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update customer profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    profileForm.reset({
      name: customer.name || "",
      age: customer.age || 30,
      location: customer.location || "",
      gender: (customer.gender as "male" | "female" | "other") || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleProfileSubmit = (data: z.infer<typeof customerProfileSchema>) => {
    if (editingCustomer) {
      updateCustomerMutation.mutate({ ...data, customerId: editingCustomer.id });
    }
  };

  const handleSearch = () => {
    if (mobile.length === 10) {
      setSearchMobile(mobile);
      setSelectedPurchase(null);
      setSelectedServices([]);
    }
  };

  const handleSelectPurchase = (purchase: PurchaseWithDetails) => {
    setSelectedPurchase(purchase);
    setSelectedServices([]);
  };

  const toggleService = (service: Service, isChecked: boolean) => {
    if (isChecked) {
      setSelectedServices([
        ...selectedServices,
        { serviceId: service.id, serviceName: service.name },
      ]);
    } else {
      setSelectedServices(selectedServices.filter((s) => s.serviceId !== service.id));
    }
  };

  const getAvailableQuantity = (service: Service, redemptions: Redemption[]) => {
    const used = redemptions.filter((r) => r.serviceId === service.id).length;
    return service.quantity - used;
  };

  const handleRedeem = () => {
    if (selectedPurchase && selectedServices.length > 0) {
      redeemMutation.mutate({
        purchaseId: selectedPurchase.id,
        services: selectedServices,
      });
    }
  };

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  const activePurchases = purchases?.filter((p) => !isPast(new Date(p.expiryDate))) || [];

  return (
    <AdminLayout title="Redeem Services">
      <div data-testid="page-admin-redeem">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Search for a customer by mobile number and redeem their services
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="h-12 pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-mobile-search"
                />
              </div>
              <Button
                size="lg"
                onClick={handleSearch}
                disabled={mobile.length !== 10}
                data-testid="button-search"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchMobile && (
          <div className="space-y-6">
            {/* Customer Profile Card */}
            {purchasesLoading ? (
              <LoadingCard />
            ) : purchases && purchases.length > 0 && purchases[0].customer ? (
              <Card data-testid="card-customer-profile">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Customer Profile
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCustomer(purchases[0].customer!)}
                      data-testid="button-edit-customer"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{purchases[0].customer.name || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Age</p>
                      <p className="font-medium">{purchases[0].customer.age || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium flex items-center gap-1">
                        {purchases[0].customer.location ? (
                          <>
                            <MapPin className="h-3.5 w-3.5" />
                            {purchases[0].customer.location}
                          </>
                        ) : (
                          "Not provided"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{purchases[0].customer.gender || "Not provided"}</p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>+91 {searchMobile}</span>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
            {/* Purchases List */}
            <div>
              <h3 className="font-semibold mb-4">Customer Packages ({purchases?.length || 0})</h3>
              {purchasesLoading ? (
                <LoadingCard />
              ) : purchases && purchases.length > 0 ? (
                <div className="space-y-4">
                  {purchases.map((purchase) => {
                    const pkg = purchase.packageSnapshot;
                    const isExpired = isPast(new Date(purchase.expiryDate));
                    const daysRemaining = differenceInDays(new Date(purchase.expiryDate), new Date());
                    const isSelected = selectedPurchase?.id === purchase.id;

                    return (
                      <Card
                        key={purchase.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "ring-2 ring-primary" : "hover-elevate"
                        }`}
                        onClick={() => handleSelectPurchase(purchase)}
                        data-testid={`card-purchase-${purchase.id}`}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-semibold">{pkg.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                Purchased {format(new Date(purchase.purchaseDate), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Badge variant={isExpired ? "destructive" : daysRemaining <= 7 ? "secondary" : "outline"}>
                              {isExpired ? "Expired" : `${daysRemaining} days left`}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              {pkg.services.length} services
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Valid till {format(new Date(purchase.expiryDate), "MMM d, yyyy")}
                            </span>
                          </div>

                          {/* Service Consumption Summary */}
                          <Separator className="my-3" />
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services Consumed</p>
                            {pkg.services.map((service) => {
                              const redemptionCount = (purchase.redemptions || []).filter(
                                (r) => r.serviceId === service.id
                              ).length;
                              const total = service.quantity;
                              const isFullyConsumed = redemptionCount >= total;
                              
                              return (
                                <div key={service.id} className="flex items-center justify-between text-sm">
                                  <span className={isFullyConsumed ? "text-muted-foreground line-through" : ""}>
                                    {service.name}
                                  </span>
                                  <Badge variant={isFullyConsumed ? "secondary" : "outline"} className="text-xs">
                                    {redemptionCount}/{total} used
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon="package"
                  title="No packages found"
                  description={`No packages found for mobile ${searchMobile}`}
                />
              )}
            </div>

            {/* Service Redemption */}
            <div>
              <h3 className="font-semibold mb-4">Redeem Services</h3>
              {selectedPurchase ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {selectedPurchase.packageSnapshot.title}
                    </CardTitle>
                    <CardDescription>
                      Select services to redeem for this customer
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedPurchase.packageSnapshot.services.map((service, index) => {
                      const available = getAvailableQuantity(service, selectedPurchase.redemptions || []);
                      const isDisabled = available <= 0;
                      const isSelected = selectedServices.some((s) => s.serviceId === service.id);

                      return (
                        <div key={service.id}>
                          {index > 0 && <Separator className="my-4" />}
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleService(service, checked as boolean)
                              }
                              disabled={isDisabled}
                              data-testid={`checkbox-service-${service.id}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`font-medium ${isDisabled ? "text-muted-foreground" : ""}`}>
                                  {service.name}
                                </span>
                                <Badge variant={available > 0 ? "outline" : "secondary"}>
                                  {available}/{service.quantity} available
                                </Badge>
                              </div>
                              {service.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {service.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <Separator className="my-4" />

                    <Button
                      className="w-full"
                      disabled={selectedServices.length === 0 || redeemMutation.isPending}
                      onClick={handleRedeem}
                      data-testid="button-redeem"
                    >
                      {redeemMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Redeem {selectedServices.length} Service{selectedServices.length !== 1 ? "s" : ""}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <EmptyState
                      icon="package"
                      title="Select a package"
                      description="Click on a customer package to view and redeem services"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          </div>
        )}

        {!searchMobile && (
          <EmptyState
            icon="users"
            title="Search for a customer"
            description="Enter a customer's mobile number to view their packages and redeem services"
          />
        )}

        {/* Edit Customer Profile Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Customer Profile</DialogTitle>
              <DialogDescription>
                Update the customer's personal information
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
                        <Input {...field} placeholder="Customer's full name" data-testid="input-customer-name" />
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
                        <Input {...field} type="number" min={1} placeholder="Age" data-testid="input-customer-age" />
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
                        <Input {...field} placeholder="City, State" data-testid="input-customer-location" />
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
                          <SelectTrigger data-testid="select-customer-gender">
                            <SelectValue placeholder="Select gender" />
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
                    data-testid="button-cancel-customer-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={updateCustomerMutation.isPending}
                    data-testid="button-save-customer"
                  >
                    {updateCustomerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
