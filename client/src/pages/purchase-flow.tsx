import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Phone, Shield, CreditCard, CheckCircle, ChevronRight, Loader2, Users, User, Baby, MapPin, ArrowLeftRight, Check, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingPage } from "@/components/loading-spinner";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPackagePricingTiers, getLowestPrice, type Package } from "@shared/schema";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

type Step = "mobile" | "otp" | "payment" | "members" | "profile" | "success";

const mobileSchema = z.object({
  mobile: z.string().regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"),
});

const otpSchema = z.object({
  otp: z.string().length(2, "Please enter the complete OTP"),
});

const memberItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(0, "Age must be positive"),
  type: z.enum(["adult", "kid"]),
});

const membersFormSchema = z.object({
  adults: z.array(memberItemSchema),
  kids: z.array(memberItemSchema),
});

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
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

const steps = ["Details", "Verify", "Payment", "Members", "Profile", "Done"];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" data-testid="step-indicator">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              index < currentStep
                ? "bg-primary text-primary-foreground"
                : index === currentStep
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {index < currentStep ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 transition-colors ${
                index < currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PurchaseFlowPage() {
  const [, params] = useRoute("/buy/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const initialPackageId = params?.id;

  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [currentPackageId, setCurrentPackageId] = useState<string | undefined>(initialPackageId);
  const [showPackageSwitcher, setShowPackageSwitcher] = useState(false);

  const packageId = currentPackageId;

  const stepIndex = { mobile: 0, otp: 1, payment: 2, members: 3, profile: 4, success: 5 }[step];

  const { data: pkg, isLoading } = useQuery<Package>({
    queryKey: ["/api/packages", packageId],
    enabled: !!packageId,
  });

  const { data: allPackages } = useQuery<Package[]>({
    queryKey: ["/api/packages/active"],
    enabled: showPackageSwitcher,
  });

  const mobileForm = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { mobile: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  // Initialize members form with correct number of adults and kids from package
  const membersForm = useForm<z.infer<typeof membersFormSchema>>({
    resolver: zodResolver(membersFormSchema),
    defaultValues: {
      adults: Array.from({ length: pkg?.adultsCount || 0 }, () => ({ name: "", age: 18, type: "adult" as const })),
      kids: Array.from({ length: pkg?.kidsCount || 0 }, () => ({ name: "", age: 5, type: "kid" as const })),
    },
  });

  // Profile form for customer details
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
      age: 30,
      location: "",
      gender: undefined,
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (data: { mobile: string }) => {
      const res = await apiRequest("POST", "/api/auth/send-otp", data);
      return res.json();
    },
    onSuccess: (data) => {
      setMobile(mobileForm.getValues("mobile"));
      setGeneratedOtp(data.otp || "");
      setStep("otp");
      toast({
        title: "OTP Sent",
        description: "Check the OTP displayed on screen",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { mobile: string; otp: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-otp", data);
      return res.json();
    },
    onSuccess: () => {
      setStep("payment");
    },
    onError: () => {
      toast({
        title: "Invalid OTP",
        description: "Please check the OTP and try again.",
        variant: "destructive",
      });
    },
  });

  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/purchases/create-order", {
        mobile,
        packageId,
        selectedTierIndex,
      });
      return res.json();
    },
    onSuccess: (data: { orderId: string; amount: number; currency: string; keyId: string; packageTitle: string; selectedTier: { adultsCount: number; kidsCount: number; price: number }; purchaseId: string }) => {
      setIsPaymentProcessing(true);
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Sakra IKOC",
        description: data.packageTitle,
        order_id: data.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await apiRequest("POST", "/api/purchases/verify-payment", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const purchase = await verifyRes.json();
            setPurchaseId(purchase.id || data.purchaseId);
            const tiers = pkg ? getPackagePricingTiers(pkg) : [];
            const tier = tiers[selectedTierIndex] || tiers[0];
            membersForm.reset({
              adults: Array.from({ length: tier?.adultsCount || 0 }, () => ({ name: "", age: 18, type: "adult" as const })),
              kids: Array.from({ length: tier?.kidsCount || 0 }, () => ({ name: "", age: 5, type: "kid" as const })),
            });
            setStep("members");
          } catch {
            toast({
              title: "Payment Verification Failed",
              description: "Your payment could not be verified. Please contact support.",
              variant: "destructive",
            });
          } finally {
            setIsPaymentProcessing(false);
          }
        },
        prefill: {
          contact: mobile,
        },
        theme: {
          color: "#E91E8C",
        },
        modal: {
          ondismiss: () => {
            setIsPaymentProcessing(false);
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setIsPaymentProcessing(false);
        toast({
          title: "Payment Failed",
          description: "Your payment was not successful. Please try again.",
          variant: "destructive",
        });
      });
      rzp.open();
    },
    onError: () => {
      setIsPaymentProcessing(false);
      toast({
        title: "Payment Failed",
        description: "Unable to initiate payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const membersMutation = useMutation({
    mutationFn: async (data: z.infer<typeof membersFormSchema>) => {
      // Ensure type is set correctly for each member
      const adults = data.adults.map(m => ({ ...m, type: "adult" as const }));
      const kids = data.kids.map(m => ({ ...m, type: "kid" as const }));
      const allMembers = [...adults, ...kids];
      const res = await apiRequest("POST", `/api/purchases/${purchaseId}/members`, {
        members: allMembers,
      });
      return res.json();
    },
    onSuccess: () => {
      setStep("profile");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save member details. Please try again.",
        variant: "destructive",
      });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileFormSchema>) => {
      const res = await apiRequest("POST", "/api/customers/profile", { ...data, mobile });
      return res.json();
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleMobileSubmit = (data: z.infer<typeof mobileSchema>) => {
    sendOtpMutation.mutate(data);
  };

  const handleOtpSubmit = (data: z.infer<typeof otpSchema>) => {
    verifyOtpMutation.mutate({ mobile, otp: data.otp });
  };

  const handlePayment = () => {
    createOrderMutation.mutate();
  };

  const handleMembersSubmit = (data: z.infer<typeof membersFormSchema>) => {
    // Validate ages before submitting
    for (const adult of data.adults) {
      if (adult.age < 16) {
        toast({
          title: "Invalid Age",
          description: `Adult "${adult.name || 'member'}" must be 16 years or older`,
          variant: "destructive",
        });
        return;
      }
    }
    for (const kid of data.kids) {
      if (kid.age >= 16) {
        toast({
          title: "Invalid Age",
          description: `Kid "${kid.name || 'member'}" must be under 16 years`,
          variant: "destructive",
        });
        return;
      }
    }
    membersMutation.mutate(data);
  };

  const handleProfileSubmit = (data: z.infer<typeof profileFormSchema>) => {
    profileMutation.mutate(data);
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Package not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button data-testid="button-back-home">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-purchase-flow">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            {step !== "success" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (step === "mobile") navigate(`/package/${currentPackageId || initialPackageId}`);
                  else if (step === "otp") setStep("mobile");
                  else if (step === "payment") setStep("otp");
                  else if (step === "members") setStep("payment");
                  else if (step === "profile") setStep("members");
                }}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {step === "success" && <div />}
            <span className="font-semibold">
              {step === "success" ? "Purchase Complete" : "Complete Purchase"}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <StepIndicator currentStep={stepIndex} />

        {/* Mobile Step */}
        {step === "mobile" && (
          <Card data-testid="step-mobile">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Enter Mobile Number
              </CardTitle>
              <CardDescription>
                We'll send you a verification code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...mobileForm}>
                <form onSubmit={mobileForm.handleSubmit(handleMobileSubmit)} className="space-y-6">
                  <FormField
                    control={mobileForm.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <div className="flex h-12 items-center justify-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                              +91
                            </div>
                            <Input
                              {...field}
                              type="tel"
                              placeholder="9876543210"
                              className="h-12 rounded-l-none"
                              maxLength={10}
                              data-testid="input-mobile"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12"
                    disabled={sendOtpMutation.isPending}
                    data-testid="button-send-otp"
                  >
                    {sendOtpMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Send OTP
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <Card data-testid="step-otp">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Verify OTP
              </CardTitle>
              <CardDescription>
                Enter the code sent to +91 {mobile}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} className="space-y-6">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormControl>
                          <InputOTP
                            maxLength={2}
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-otp"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {generatedOtp && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center" data-testid="display-generated-otp">
                      <p className="text-xs text-muted-foreground mb-1">Generated OTP (for testing)</p>
                      <p className="text-2xl font-bold tracking-widest text-primary">{generatedOtp}</p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12"
                    disabled={verifyOtpMutation.isPending}
                    data-testid="button-verify-otp"
                  >
                    {verifyOtpMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verify & Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Payment Step */}
        {step === "payment" && (() => {
          const tiers = getPackagePricingTiers(pkg);
          const selectedTier = tiers[selectedTierIndex] || tiers[0];
          return (
            <div className="space-y-6" data-testid="step-payment">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payment
                  </CardTitle>
                  <CardDescription>
                    {tiers.length > 1 ? "Select your preferred option and complete your purchase" : "Complete your purchase"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium mb-2">{pkg.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {pkg.services.length} services • {pkg.validityMonths} months validity
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPackageSwitcher(true)}
                        data-testid="button-change-package"
                      >
                        <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                        Change
                      </Button>
                    </div>
                  </div>

                  {tiers.length > 1 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Choose your option
                      </h4>
                      {tiers.map((tier, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-4 rounded-md border cursor-pointer transition-colors ${
                            selectedTierIndex === index
                              ? "border-primary bg-primary/5"
                              : "hover-elevate"
                          }`}
                          onClick={() => setSelectedTierIndex(index)}
                          data-testid={`tier-select-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                              selectedTierIndex === index ? "border-primary" : "border-muted-foreground"
                            }`}>
                              {selectedTierIndex === index && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <Badge variant="outline" className="gap-1">
                              {tier.adultsCount} Adults, {tier.kidsCount} Kids
                            </Badge>
                          </div>
                          <span className="text-lg font-bold">{formatPrice(tier.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="text-xl font-bold">{formatPrice(selectedTier.price)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTier.adultsCount} Adults, {selectedTier.kidsCount} Kids covered
                  </div>

                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full"
                onClick={handlePayment}
                disabled={createOrderMutation.isPending || isPaymentProcessing}
                data-testid="button-pay"
              >
                {(createOrderMutation.isPending || isPaymentProcessing) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {isPaymentProcessing ? "Processing..." : `Pay ${formatPrice(selectedTier.price)}`}
              </Button>
            </div>
          );
        })()}

        {/* Members Step */}
        {step === "members" && (() => {
          const tiers = getPackagePricingTiers(pkg);
          const selectedTier = tiers[selectedTierIndex] || tiers[0];
          return (
          <div className="space-y-6" data-testid="step-members">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Member Details
                </CardTitle>
                <CardDescription>
                  Enter details for all covered members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...membersForm}>
                  <form onSubmit={membersForm.handleSubmit(handleMembersSubmit)} className="space-y-6">
                    {/* Adults Section */}
                    {selectedTier.adultsCount > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <h3 className="font-medium">Adults ({selectedTier.adultsCount})</h3>
                          <Badge variant="secondary" className="text-xs">Age 16+</Badge>
                        </div>
                        {Array.from({ length: selectedTier.adultsCount }).map((_, index) => (
                          <div key={`adult-${index}`} className="rounded-lg border p-4 space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">Adult {index + 1}</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField
                                control={membersForm.control}
                                name={`adults.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Full name"
                                        data-testid={`input-adult-${index}-name`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={membersForm.control}
                                name={`adults.${index}.age`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Age</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min={16}
                                        placeholder="Age (16+)"
                                        data-testid={`input-adult-${index}-age`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Kids Section */}
                    {selectedTier.kidsCount > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Baby className="h-4 w-4 text-primary" />
                          <h3 className="font-medium">Kids ({selectedTier.kidsCount})</h3>
                          <Badge variant="secondary" className="text-xs">Under 16</Badge>
                        </div>
                        {Array.from({ length: selectedTier.kidsCount }).map((_, index) => (
                          <div key={`kid-${index}`} className="rounded-lg border p-4 space-y-4">
                            <p className="text-sm font-medium text-muted-foreground">Kid {index + 1}</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField
                                control={membersForm.control}
                                name={`kids.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Full name"
                                        data-testid={`input-kid-${index}-name`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={membersForm.control}
                                name={`kids.${index}.age`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Age</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min={0}
                                        max={15}
                                        placeholder="Age (0-15)"
                                        data-testid={`input-kid-${index}-age`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-12"
                      disabled={membersMutation.isPending}
                      data-testid="button-save-members"
                    >
                      {membersMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Continue to Profile
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
          );
        })()}

        {/* Profile Step */}
        {step === "profile" && (
          <div className="space-y-6" data-testid="step-profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Your Profile
                </CardTitle>
                <CardDescription>
                  Please provide your details to complete registration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter your full name"
                              data-testid="input-profile-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email address"
                              data-testid="input-profile-email"
                            />
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
                          <FormLabel>Your Age</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={1}
                              placeholder="Enter your age"
                              data-testid="input-profile-age"
                            />
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
                            <Input
                              {...field}
                              placeholder="City, State"
                              data-testid="input-profile-location"
                            />
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-profile-gender">
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
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-12"
                      disabled={profileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {profileMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Complete Purchase
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="text-center space-y-6" data-testid="step-success">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
              <p className="text-muted-foreground">
                Your package has been activated
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-medium">{pkg.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobile</span>
                    <span className="font-medium">+91 {mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-medium">{formatPrice(pkg.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validity</span>
                    <span className="font-medium">{pkg.validityMonths} months</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button
                className="w-full h-12"
                onClick={() => navigate("/login")}
                data-testid="button-view-card"
              >
                View My Card
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/")}
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={showPackageSwitcher} onOpenChange={setShowPackageSwitcher}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Switch Package</DialogTitle>
            <DialogDescription>Select a different healthcare package</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {allPackages?.filter(p => !p.isEnterprise).map((p) => {
              const isSelected = p.id === packageId;
              return (
                <div
                  key={p.id}
                  className={`flex items-start justify-between gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "hover-elevate"
                  }`}
                  onClick={() => {
                    if (!isSelected) {
                      setCurrentPackageId(p.id);
                      setSelectedTierIndex(0);
                    }
                    setShowPackageSwitcher(false);
                  }}
                  data-testid={`switcher-package-${p.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.title}</span>
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{p.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {p.validityMonths} months
                      </span>
                      <span>{p.services.length} services</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-bold">{formatPrice(getLowestPrice(p))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
