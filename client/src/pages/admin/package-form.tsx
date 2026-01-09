import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Loader2, Save } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingPage } from "@/components/loading-spinner";
import { useAdminAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Package } from "@shared/schema";

const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Service name is required"),
  description: z.string(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

const packageFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  services: z.array(serviceSchema).min(1, "At least one service is required"),
  validityDays: z.number().min(1, "Validity must be at least 1 day"),
  price: z.number().min(100, "Price must be at least ₹1"),
  termsAndConditions: z.string().optional(),
  isActive: z.boolean().default(true),
});

type PackageFormData = z.infer<typeof packageFormSchema>;

function generateServiceId() {
  return `svc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function PackageFormPage() {
  const [matchNew] = useRoute("/admin/packages/new");
  const [matchEdit, editParams] = useRoute("/admin/packages/:id/edit");
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();

  const isNew = matchNew;
  const packageId = editParams?.id;

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: {
      title: "",
      description: "",
      services: [{ id: generateServiceId(), name: "", description: "", quantity: 1 }],
      validityDays: 30,
      price: 0,
      termsAndConditions: "",
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "services",
  });

  const { data: existingPackage, isLoading: packageLoading } = useQuery<Package>({
    queryKey: ["/api/packages", packageId],
    enabled: !!packageId && !!token,
  });

  useEffect(() => {
    if (existingPackage) {
      form.reset({
        title: existingPackage.title,
        description: existingPackage.description,
        services: existingPackage.services,
        validityDays: existingPackage.validityDays,
        price: existingPackage.price,
        termsAndConditions: existingPackage.termsAndConditions || "",
        isActive: existingPackage.isActive,
      });
    }
  }, [existingPackage, form]);

  const createMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const res = await apiRequest("POST", "/api/packages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      toast({
        title: "Package Created",
        description: "Your new package has been created successfully.",
      });
      navigate("/admin/packages");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create package. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const res = await apiRequest("PUT", `/api/packages/${packageId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages", packageId] });
      toast({
        title: "Package Updated",
        description: "Your package has been updated successfully.",
      });
      navigate("/admin/packages");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update package. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PackageFormData) => {
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (authLoading || (!isNew && packageLoading)) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  return (
    <AdminLayout title={isNew ? "Create Package" : "Edit Package"}>
      <div data-testid="page-package-form">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/admin/packages")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Packages
        </Button>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Package details visible to customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Premium Health Checkup"
                          className="h-12"
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe what this package offers..."
                          className="min-h-[100px]"
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (in paise)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              ₹
                            </span>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              placeholder="100000 (= ₹1000)"
                              className="h-12 pl-8"
                              data-testid="input-price"
                            />
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Enter price in paise (100 paise = ₹1)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validityDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validity (days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="30"
                            className="h-12"
                            data-testid="input-validity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>
                  Add the services included in this package
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`services.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Service Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g., Blood Test"
                                    className="h-12"
                                    data-testid={`input-service-name-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`services.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    min={1}
                                    className="h-12"
                                    data-testid={`input-service-quantity-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name={`services.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (optional)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Brief description of the service"
                                  className="h-12"
                                  data-testid={`input-service-description-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-8"
                          onClick={() => remove(index)}
                          data-testid={`button-remove-service-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    append({ id: generateServiceId(), name: "", description: "", quantity: 1 })
                  }
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </CardContent>
            </Card>

            {/* Terms */}
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
                <CardDescription>
                  Optional terms and conditions for this package
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="termsAndConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter terms and conditions..."
                          className="min-h-[150px]"
                          data-testid="input-terms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/packages")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isNew ? "Create Package" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}
