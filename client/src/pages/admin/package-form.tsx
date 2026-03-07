import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Loader2, Save, Hash, Percent, Infinity, Users, Copy, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingPage } from "@/components/loading-spinner";
import { useAdminAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPackagePricingTiers, type Package } from "@shared/schema";

const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Service name is required"),
  description: z.string(),
  type: z.enum(["quantity", "percentage"]).default("quantity"),
  quantity: z.number().min(1).default(1),
  isUnlimited: z.boolean().default(false),
  percentage: z.number().min(0).max(100).optional(),
});

const pricingTierFormSchema = z.object({
  adultsCount: z.number().min(0, "Adults count cannot be negative"),
  kidsCount: z.number().min(0, "Kids count cannot be negative"),
  price: z.number().min(1, "Price must be at least ₹1"),
});

const packageFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  services: z.array(serviceSchema).min(1, "At least one service is required"),
  validityMonths: z.number().min(1, "Validity must be at least 1 month"),
  pricingTiers: z.array(pricingTierFormSchema).min(1, "At least one pricing tier is required"),
  termsAndConditions: z.string().optional(),
  isActive: z.boolean().default(true),
  isEnterprise: z.boolean().default(false),
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

  const searchParams = new URLSearchParams(window.location.search);
  const cloneId = searchParams.get("clone");
  const isClone = matchNew && !!cloneId;
  const isNew = matchNew && !cloneId;
  const packageId = editParams?.id || cloneId;

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: {
      title: "",
      description: "",
      services: [{ id: generateServiceId(), name: "", description: "", type: "quantity" as const, quantity: 1, isUnlimited: false, percentage: undefined }],
      validityMonths: 12,
      pricingTiers: [{ adultsCount: 1, kidsCount: 0, price: 0 }],
      termsAndConditions: "",
      isActive: true,
      isEnterprise: false,
    },
  });

  const { fields: serviceFields, append: appendService, remove: removeService, move: moveService, insert: insertService } = useFieldArray({
    control: form.control,
    name: "services",
  });

  const csvFileRef = useRef<HTMLInputElement>(null);

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "CSV must have a header row and at least one data row.", variant: "destructive" });
        return;
      }
      const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const nameIdx = header.findIndex(h => h === "service name");
      const typeIdx = header.findIndex(h => h === "service type");
      const numberIdx = header.findIndex(h => h === "number");
      const descIdx = header.findIndex(h => h === "description");
      if (nameIdx === -1) {
        toast({ title: "Invalid CSV", description: "CSV must have a 'Service Name' column.", variant: "destructive" });
        return;
      }
      const parsed: { id: string; name: string; description: string; type: "quantity" | "percentage"; quantity: number; isUnlimited: boolean; percentage?: number }[] = [];
      const skipped: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = cols[nameIdx] || "";
        if (!name) { skipped.push(i + 1); continue; }
        const rawType = typeIdx >= 0 ? (cols[typeIdx] || "1") : "1";
        const rawNumber = numberIdx >= 0 ? (cols[numberIdx] || "1") : "1";
        const desc = descIdx >= 0 ? (cols[descIdx] || "") : "";
        if (rawType !== "1" && rawType !== "2") { skipped.push(i + 1); continue; }
        const num = parseFloat(rawNumber);
        if (isNaN(num)) { skipped.push(i + 1); continue; }
        if (rawType === "2") {
          parsed.push({ id: generateServiceId(), name, description: desc, type: "percentage", quantity: 1, isUnlimited: false, percentage: Math.min(100, Math.max(0, num)) });
        } else {
          const isUnlimited = num === -1;
          parsed.push({ id: generateServiceId(), name, description: desc, type: "quantity", quantity: isUnlimited ? 1 : Math.max(1, Math.round(num)), isUnlimited });
        }
      }
      if (parsed.length === 0) {
        toast({ title: "No Services Found", description: "No valid services could be parsed from the CSV.", variant: "destructive" });
        return;
      }
      const existing = form.getValues("services");
      const hasEmptyOnly = existing.length === 1 && !existing[0].name;
      if (hasEmptyOnly) {
        form.setValue("services", parsed);
      } else {
        form.setValue("services", [...existing, ...parsed]);
      }
      const msg = skipped.length > 0
        ? `${parsed.length} service(s) added. ${skipped.length} row(s) skipped (rows ${skipped.join(", ")}).`
        : `${parsed.length} service(s) added from CSV.`;
      toast({ title: "Services Imported", description: msg });
    };
    reader.readAsText(file);
    if (csvFileRef.current) csvFileRef.current.value = "";
  };

  const { fields: tierFields, append: appendTier, remove: removeTier } = useFieldArray({
    control: form.control,
    name: "pricingTiers",
  });

  const { data: existingPackage, isLoading: packageLoading } = useQuery<Package>({
    queryKey: ["/api/packages", packageId],
    enabled: !!packageId && !!token,
  });

  useEffect(() => {
    if (existingPackage) {
      const tiers = getPackagePricingTiers(existingPackage);
      form.reset({
        title: isClone ? `${existingPackage.title} (Copy)` : existingPackage.title,
        description: existingPackage.description,
        services: existingPackage.services.map((s) => ({
          ...s,
          id: isClone ? generateServiceId() : s.id,
          type: s.type || "quantity",
          isUnlimited: s.isUnlimited || false,
          percentage: s.percentage,
        })),
        validityMonths: existingPackage.validityMonths,
        pricingTiers: tiers.map(t => ({ adultsCount: t.adultsCount, kidsCount: t.kidsCount, price: t.price })),
        termsAndConditions: existingPackage.termsAndConditions || "",
        isActive: true,
        isEnterprise: existingPackage.isEnterprise || false,
      });
    }
  }, [existingPackage, form, isClone]);

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
    onError: (error: any) => {
      const msg = error?.message || "Failed to create package. Please try again.";
      toast({
        title: "Error",
        description: msg,
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
    if (isNew || isClone) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (authLoading || (!(isNew && !isClone) && packageLoading)) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  return (
    <AdminLayout title={isClone ? "Clone Package" : isNew ? "Create Package" : "Edit Package"}>
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
                <FormField
                  control={form.control}
                  name="validityMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validity (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          placeholder="12"
                          className="h-12"
                          data-testid="input-validity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Separator className="my-4" />
                <FormField
                  control={form.control}
                  name="isEnterprise"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enterprise Package</FormLabel>
                        <FormDescription>
                          Enterprise packages are not visible to customers on the website
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enterprise"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Pricing Tiers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pricing
                </CardTitle>
                <CardDescription>
                  Set up pricing based on number of people covered. Add multiple tiers for different group sizes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tierFields.map((field, index) => (
                  <div key={field.id} className="space-y-3">
                    {index > 0 && <Separator />}
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-medium text-muted-foreground">Tier {index + 1}</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`pricingTiers.${index}.adultsCount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Adults</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    min={0}
                                    placeholder="1"
                                    className="h-12"
                                    data-testid={`input-tier-adults-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`pricingTiers.${index}.kidsCount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Kids</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                    className="h-12"
                                    data-testid={`input-tier-kids-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`pricingTiers.${index}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (₹)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                      ₹
                                    </span>
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      placeholder="1000"
                                      className="h-12 pl-8"
                                      data-testid={`input-tier-price-${index}`}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      {tierFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-8"
                          onClick={() => removeTier(index)}
                          data-testid={`button-remove-tier-${index}`}
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
                  onClick={() => appendTier({ adultsCount: 1, kidsCount: 0, price: 0 })}
                  data-testid="button-add-tier"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pricing Tier
                </Button>
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
                {serviceFields.map((field, index) => {
                  const serviceType = form.watch(`services.${index}.type`);
                  const isUnlimited = form.watch(`services.${index}.isUnlimited`);
                  return (
                    <div key={field.id} className="space-y-4">
                      {index > 0 && <Separator />}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Service {index + 1}</span>
                        <div className="flex items-center gap-1 ml-auto">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            onClick={() => moveService(index, index - 1)}
                            data-testid={`button-move-service-up-${index}`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === serviceFields.length - 1}
                            onClick={() => moveService(index, index + 1)}
                            data-testid={`button-move-service-down-${index}`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const current = form.getValues(`services.${index}`);
                              insertService(index + 1, {
                                ...current,
                                id: generateServiceId(),
                              });
                            }}
                            data-testid={`button-duplicate-service-${index}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {serviceFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeService(index)}
                              data-testid={`button-remove-service-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
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
                                      placeholder="e.g., OPD Consulting"
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
                              name={`services.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Service Type</FormLabel>
                                  <Select
                                    value={field.value}
                                    onValueChange={(val) => {
                                      field.onChange(val);
                                      if (val === "percentage") {
                                        form.setValue(`services.${index}.isUnlimited`, false);
                                        form.setValue(`services.${index}.quantity`, 1);
                                        form.setValue(`services.${index}.percentage`, 10);
                                      } else {
                                        form.setValue(`services.${index}.percentage`, undefined);
                                      }
                                    }}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-12" data-testid={`select-service-type-${index}`}>
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="quantity">
                                        <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Number of Services</span>
                                      </SelectItem>
                                      <SelectItem value="percentage">
                                        <span className="flex items-center gap-2"><Percent className="h-3.5 w-3.5" /> Percentage Off</span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          {serviceType === "quantity" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField
                                control={form.control}
                                name={`services.${index}.isUnlimited`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-sm">Unlimited</FormLabel>
                                      <FormDescription className="text-xs">No limit on usage</FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        data-testid={`switch-service-unlimited-${index}`}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              {!isUnlimited && (
                                <FormField
                                  control={form.control}
                                  name={`services.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Number of Times</FormLabel>
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
                              )}
                            </div>
                          )}
                          {serviceType === "percentage" && (
                            <FormField
                              control={form.control}
                              name={`services.${index}.percentage`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Discount Percentage</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        value={field.value ?? ""}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        min={0}
                                        max={100}
                                        placeholder="10"
                                        className="h-12 pr-8"
                                        data-testid={`input-service-percentage-${index}`}
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
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
                      </div>
                    </div>
                  );
                })}
                <input
                  type="file"
                  accept=".csv"
                  ref={csvFileRef}
                  className="hidden"
                  onChange={handleCsvUpload}
                  data-testid="input-csv-upload"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      appendService({ id: generateServiceId(), name: "", description: "", type: "quantity", quantity: 1, isUnlimited: false, percentage: undefined })
                    }
                    data-testid="button-add-service"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => csvFileRef.current?.click()}
                    data-testid="button-upload-csv"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Button>
                </div>
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
