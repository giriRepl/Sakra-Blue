import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, ArrowLeft, ArrowRight, Check, Loader2, User, Baby, KeyRound, Package as PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingCard, LoadingPage } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAdminAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPackagePricingTiers, type Package as PackageType } from "@shared/schema";

type Step = "package" | "mobile" | "otp" | "holder" | "members" | "sale" | "confirm";

const holderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email").or(z.literal("")).optional(),
  age: z.coerce.number().min(1, "Age must be positive"),
  location: z.string().min(1, "Location is required"),
  gender: z.enum(["male", "female", "other"], { required_error: "Please select gender" }),
});

const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(1, "Age must be positive"),
  relation: z.string().min(1, "Relation is required"),
});

const saleSchema = z.object({
  salesPersonName: z.string().min(1, "Salesperson name is required"),
  amountCollected: z.coerce.number().min(0, "Amount must be 0 or more"),
  modeOfPayment: z.enum(["cash", "card", "upi", "neft", "cheque"], {
    required_error: "Please select a payment mode",
  }),
});

type HolderData = z.infer<typeof holderSchema>;
type MemberData = z.infer<typeof memberSchema>;
type SaleData = z.infer<typeof saleSchema>;

interface MemberWithType extends MemberData {
  type: "adult" | "kid";
}

export default function AdminAssignPage() {
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("package");
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [mobile, setMobile] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [holderData, setHolderData] = useState<HolderData | null>(null);
  const [members, setMembers] = useState<MemberWithType[]>([]);
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [saleDetails, setSaleDetails] = useState<SaleData | null>(null);

  const holderForm = useForm<HolderData>({
    resolver: zodResolver(holderSchema),
    defaultValues: {
      name: "",
      email: "",
      age: 30,
      location: "",
      gender: undefined,
    },
  });

  const memberForm = useForm<MemberData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      age: 30,
      relation: "",
    },
  });

  const saleForm = useForm<SaleData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      salesPersonName: "",
      amountCollected: 0,
      modeOfPayment: undefined,
    },
  });

  const { data: packages, isLoading: packagesLoading } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
    enabled: !!token,
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (mob: string) => {
      const res = await apiRequest("POST", "/api/admin/assign/send-otp", { mobile: mob });
      return res.json();
    },
    onSuccess: () => {
      setEnteredOtp("");
      setOtpError("");
      setStep("otp");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send OTP",
        description: error.message || "Could not send OTP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ mob, otp }: { mob: string; otp: string }) => {
      const res = await apiRequest("POST", "/api/admin/assign/verify-otp", { mobile: mob, otp });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid OTP");
      }
      return res.json();
    },
    onSuccess: () => {
      setStep("holder");
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Invalid OTP. Please try again.");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: {
      packageId: string;
      mobile: string;
      holder: HolderData;
      members: MemberWithType[];
      selectedTierIndex?: number;
      saleDetails?: SaleData;
    }) => {
      const res = await apiRequest("POST", "/api/admin/assign-package", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Package Assigned",
        description: "The package has been successfully assigned to the customer.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/purchases"] });
      resetFlow();
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign package. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetFlow = () => {
    setStep("package");
    setSelectedPackage(null);
    setSelectedTierIndex(0);
    setMobile("");
    setEnteredOtp("");
    setOtpError("");
    setHolderData(null);
    setMembers([]);
    setCurrentMemberIndex(0);
    setSaleDetails(null);
    holderForm.reset();
    memberForm.reset();
    saleForm.reset();
  };

  const activePackages = packages?.filter((p) => p.isActive) || [];

  const handlePackageSelect = (pkg: PackageType) => {
    setSelectedPackage(pkg);
    setSelectedTierIndex(0);
    setStep("mobile");
  };

  const handleMobileSubmit = () => {
    if (mobile.length === 10) {
      sendOtpMutation.mutate(mobile);
    }
  };

  const handleOtpVerify = () => {
    verifyOtpMutation.mutate({ mob: mobile, otp: enteredOtp });
  };

  const handleHolderSubmit = (data: HolderData) => {
    setHolderData(data);
    
    if (!selectedPackage) return;
    
    const tiers = getPackagePricingTiers(selectedPackage);
    const tier = tiers[selectedTierIndex] || tiers[0];
    const adultsCount = tier?.adultsCount || selectedPackage.adultsCount;
    const kidsCount = tier?.kidsCount || selectedPackage.kidsCount;
    const totalMembers = (adultsCount - 1) + kidsCount;
    
    if (totalMembers > 0) {
      const membersList: MemberWithType[] = [];
      for (let i = 0; i < adultsCount - 1; i++) {
        membersList.push({ name: "", age: 30, relation: "", type: "adult" });
      }
      for (let i = 0; i < kidsCount; i++) {
        membersList.push({ name: "", age: 10, relation: "", type: "kid" });
      }
      setMembers(membersList);
      setCurrentMemberIndex(0);
      memberForm.reset({ name: "", age: membersList[0]?.type === "kid" ? 10 : 30, relation: "" });
      setStep("members");
    } else {
      // Reset sale form amount to tier price before showing sale step
      const tierPrice = (tiers[selectedTierIndex] || tiers[0])?.price ?? 0;
      saleForm.reset({ salesPersonName: "", amountCollected: tierPrice, modeOfPayment: undefined });
      setStep("sale");
    }
  };

  const handleMemberSubmit = (data: MemberData) => {
    const updatedMembers = [...members];
    updatedMembers[currentMemberIndex] = {
      ...data,
      type: members[currentMemberIndex].type,
    };
    setMembers(updatedMembers);

    if (currentMemberIndex < members.length - 1) {
      const nextIndex = currentMemberIndex + 1;
      setCurrentMemberIndex(nextIndex);
      memberForm.reset({
        name: "",
        age: updatedMembers[nextIndex]?.type === "kid" ? 10 : 30,
        relation: "",
      });
    } else {
      // Reset sale form amount to tier price before showing sale step
      const tiers = getPackagePricingTiers(selectedPackage!);
      const tierPrice = (tiers[selectedTierIndex] || tiers[0])?.price ?? 0;
      saleForm.reset({ salesPersonName: "", amountCollected: tierPrice, modeOfPayment: undefined });
      setStep("sale");
    }
  };

  const handleSaleSubmit = (data: SaleData) => {
    setSaleDetails(data);
    setStep("confirm");
  };

  const handlePrevMember = () => {
    if (currentMemberIndex > 0) {
      const prevIndex = currentMemberIndex - 1;
      setCurrentMemberIndex(prevIndex);
      memberForm.reset({
        name: members[prevIndex].name,
        age: members[prevIndex].age,
        relation: members[prevIndex].relation,
      });
    }
  };

  const handleConfirm = () => {
    if (!selectedPackage || !holderData) return;

    assignMutation.mutate({
      packageId: selectedPackage.id.toString(),
      mobile,
      holder: holderData,
      members,
      selectedTierIndex,
      saleDetails: saleDetails ?? undefined,
    });
  };

  const goBack = () => {
    switch (step) {
      case "mobile":
        setStep("package");
        break;
      case "otp":
        setStep("mobile");
        break;
      case "holder":
        setStep("otp");
        break;
      case "members":
        if (currentMemberIndex === 0) {
          setStep("holder");
        } else {
          handlePrevMember();
        }
        break;
      case "sale":
        if (members.length > 0) {
          setCurrentMemberIndex(members.length - 1);
          memberForm.reset({
            name: members[members.length - 1].name,
            age: members[members.length - 1].age,
            relation: members[members.length - 1].relation,
          });
          setStep("members");
        } else {
          setStep("holder");
        }
        break;
      case "confirm":
        setStep("sale");
        break;
    }
  };

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  const currentMember = members[currentMemberIndex];
  const totalSteps = selectedPackage ? 4 + (selectedPackage.adultsCount - 1 + selectedPackage.kidsCount > 0 ? 1 : 0) : 4;

  return (
    <AdminLayout title="Assign Package">
      <div data-testid="page-admin-assign" className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Assign a healthcare package to a customer
          </p>
        </div>

        {step !== "package" && (
          <Button
            variant="ghost"
            className="mb-4"
            onClick={goBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        {/* Step 1: Select Package */}
        {step === "package" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Select a Package</h2>
            {packagesLoading ? (
              <LoadingCard />
            ) : activePackages.length > 0 ? (
              <div className="grid gap-4">
                {activePackages.map((pkg) => {
                  const tiers = getPackagePricingTiers(pkg);
                  const lowestPrice = tiers.length > 0
                    ? Math.min(...tiers.map(t => t.price))
                    : pkg.price;
                  return (
                  <Card
                    key={pkg.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => handlePackageSelect(pkg)}
                    data-testid={`card-package-${pkg.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{pkg.title}</h3>
                            {pkg.isEnterprise && (
                              <Badge variant="outline" className="text-xs">Enterprise</Badge>
                            )}
                            {tiers.length > 1 && (
                              <Badge variant="secondary" className="text-xs">{tiers.length} tiers</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {pkg.description}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                            {tiers.length <= 1 ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" />
                                  {tiers[0]?.adultsCount || pkg.adultsCount} Adults
                                </span>
                                <span className="flex items-center gap-1">
                                  <Baby className="h-3.5 w-3.5" />
                                  {tiers[0]?.kidsCount || pkg.kidsCount} Kids
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Multiple coverage options</span>
                            )}
                            <span className="flex items-center gap-1">
                              <PackageIcon className="h-3.5 w-3.5" />
                              {pkg.services.length} Services
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          {tiers.length > 1 && (
                            <p className="text-xs text-muted-foreground">Starts at</p>
                          )}
                          <p className="text-lg font-bold text-primary">₹{lowestPrice.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{pkg.validityMonths} months</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon="package"
                title="No active packages"
                description="Create some packages first to assign them to customers"
              />
            )}
          </div>
        )}

        {/* Step 2: Enter Mobile */}
        {step === "mobile" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Customer Mobile Number
              </CardTitle>
              <CardDescription>
                Enter the customer's mobile number to assign the package
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPackage && (() => {
                const tiers = getPackagePricingTiers(selectedPackage);
                const currentTier = tiers[selectedTierIndex] || tiers[0];
                return (
                  <div className="space-y-3 mb-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium">{selectedPackage.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentTier.adultsCount} Adults, {currentTier.kidsCount} Kids - ₹{currentTier.price.toLocaleString()}
                      </p>
                    </div>
                    {tiers.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Select tier:</p>
                        {tiers.map((tier, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                              selectedTierIndex === index
                                ? "border-primary bg-primary/5"
                                : "hover-elevate"
                            }`}
                            onClick={() => setSelectedTierIndex(index)}
                            data-testid={`assign-tier-select-${index}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                selectedTierIndex === index ? "border-primary" : "border-muted-foreground"
                              }`}>
                                {selectedTierIndex === index && (
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <span className="text-sm">{tier.adultsCount} Adults, {tier.kidsCount} Kids</span>
                            </div>
                            <span className="font-medium">₹{tier.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">+91</span>
                <Input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="h-12 pl-12"
                  onKeyDown={(e) => e.key === "Enter" && handleMobileSubmit()}
                  data-testid="input-mobile"
                />
              </div>
              <Button
                className="w-full"
                disabled={mobile.length !== 10 || sendOtpMutation.isPending}
                onClick={handleMobileSubmit}
                data-testid="button-continue-mobile"
              >
                {sendOtpMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending OTP…</>
                ) : (
                  <>Send OTP <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: OTP Verification */}
        {step === "otp" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Verify OTP
              </CardTitle>
              <CardDescription>
                An OTP has been sent to the customer's mobile{" "}
                <span className="font-medium text-foreground">+91 {mobile}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm text-center font-medium">Enter the OTP received by the customer</p>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={4}
                    value={enteredOtp}
                    onChange={(value) => {
                      setEnteredOtp(value);
                      setOtpError("");
                    }}
                    data-testid="input-otp"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {otpError && (
                  <p className="text-sm text-destructive text-center" data-testid="text-otp-error">{otpError}</p>
                )}
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    disabled={sendOtpMutation.isPending}
                    onClick={() => sendOtpMutation.mutate(mobile)}
                    data-testid="button-resend-otp"
                  >
                    {sendOtpMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sending…</>
                    ) : "Resend OTP"}
                  </Button>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={enteredOtp.length !== 4 || verifyOtpMutation.isPending}
                onClick={handleOtpVerify}
                data-testid="button-verify-otp"
              >
                {verifyOtpMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</>
                ) : (
                  <>Verify & Continue <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Account Holder Details */}
        {step === "holder" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Account Holder Details
              </CardTitle>
              <CardDescription>
                Enter the primary account holder's information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...holderForm}>
                <form onSubmit={holderForm.handleSubmit(handleHolderSubmit)} className="space-y-4">
                  <FormField
                    control={holderForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter full name" className="h-12" data-testid="input-holder-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={holderForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email ID <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="customer@email.com" className="h-12" data-testid="input-holder-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={holderForm.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} placeholder="Age" className="h-12" data-testid="input-holder-age" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={holderForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12" data-testid="select-holder-gender">
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
                  </div>
                  <FormField
                    control={holderForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="City, State" className="h-12" data-testid="input-holder-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" data-testid="button-continue-holder">
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Other Members */}
        {step === "members" && currentMember && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentMember.type === "adult" ? (
                  <User className="h-5 w-5 text-primary" />
                ) : (
                  <Baby className="h-5 w-5 text-primary" />
                )}
                {currentMember.type === "adult" ? "Adult" : "Child"} Member {currentMemberIndex + 1}
              </CardTitle>
              <CardDescription>
                <div className="flex items-center justify-between">
                  <span>Enter details for {currentMember.type === "adult" ? "adult" : "child"} member</span>
                  <Badge variant="outline">
                    {currentMemberIndex + 1} of {members.length}
                  </Badge>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...memberForm}>
                <form onSubmit={memberForm.handleSubmit(handleMemberSubmit)} className="space-y-4">
                  <FormField
                    control={memberForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter full name" className="h-12" data-testid="input-member-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={memberForm.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} placeholder="Age" className="h-12" data-testid="input-member-age" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={memberForm.control}
                      name="relation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relation to Account Holder</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Spouse, Son, Daughter" className="h-12" data-testid="input-member-relation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full" data-testid="button-continue-member">
                    {currentMemberIndex === members.length - 1 ? "Continue to Review" : "Next Member"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Sale Details */}
        {step === "sale" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="h-5 w-5 text-primary" />
                Sale Details
              </CardTitle>
              <CardDescription>
                Enter salesperson and payment information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...saleForm}>
                <form onSubmit={saleForm.handleSubmit(handleSaleSubmit)} className="space-y-4">
                  <FormField
                    control={saleForm.control}
                    name="salesPersonName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salesperson Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter salesperson's name" className="h-12" data-testid="input-sales-person-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={saleForm.control}
                    name="amountCollected"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Collected (₹)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={0} placeholder="0" className="h-12" data-testid="input-amount-collected" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={saleForm.control}
                    name="modeOfPayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mode of Payment</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-mode-of-payment">
                              <SelectValue placeholder="Select payment mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="neft">NEFT / Bank Transfer</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" data-testid="button-continue-sale">
                    Review & Confirm
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 7: Confirmation */}
        {step === "confirm" && selectedPackage && holderData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Review & Confirm
              </CardTitle>
              <CardDescription>
                Review the details before assigning the package
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Package Info */}
              {(() => {
                const tiers = getPackagePricingTiers(selectedPackage);
                const tier = tiers[selectedTierIndex] || tiers[0];
                return (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Package</h4>
                    <div className="p-3 rounded-lg border">
                      <p className="font-semibold">{selectedPackage.title}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span>₹{tier.price.toLocaleString()}</span>
                        <span>{tier.adultsCount} Adults, {tier.kidsCount} Kids</span>
                        <span>{selectedPackage.validityMonths} months validity</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Mobile */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Mobile Number</h4>
                <p className="font-medium">+91 {mobile}</p>
              </div>

              <Separator />

              {/* Account Holder */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Account Holder</h4>
                <div className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">{holderData.name}</span>
                    <Badge variant="secondary" className="ml-auto">Primary</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {holderData.age} years, {holderData.gender} • {holderData.location}
                  </p>
                  {holderData.email && (
                    <p className="text-sm text-muted-foreground">{holderData.email}</p>
                  )}
                </div>
              </div>

              {/* Other Members */}
              {members.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Other Members ({members.length})</h4>
                  <div className="space-y-2">
                    {members.map((member, index) => (
                      <div key={index} className="p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          {member.type === "adult" ? (
                            <User className="h-4 w-4 text-primary" />
                          ) : (
                            <Baby className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{member.name}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {member.type === "adult" ? "Adult" : "Child"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {member.age} years • {member.relation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sale Details */}
              {saleDetails && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Sale Details</h4>
                    <div className="p-3 rounded-lg border space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Salesperson</span>
                        <span className="font-medium">{saleDetails.salesPersonName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount Collected</span>
                        <span className="font-semibold text-primary">₹{Number(saleDetails.amountCollected).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode of Payment</span>
                        <span className="font-medium capitalize">{saleDetails.modeOfPayment === "neft" ? "NEFT / Bank Transfer" : saleDetails.modeOfPayment}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <Button
                className="w-full"
                onClick={handleConfirm}
                disabled={assignMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirm & Assign Package
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
