import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Phone, Shield, CreditCard, CheckCircle, ChevronRight, Loader2 } from "lucide-react";
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
import { LoadingPage } from "@/components/loading-spinner";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Package } from "@shared/schema";

type Step = "mobile" | "otp" | "payment" | "success";

const mobileSchema = z.object({
  mobile: z.string().regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"),
});

const otpSchema = z.object({
  otp: z.string().length(2, "Please enter the complete OTP"),
});

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

const steps = ["Details", "Verify", "Payment", "Success"];

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
  const packageId = params?.id;

  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);

  const stepIndex = { mobile: 0, otp: 1, payment: 2, success: 3 }[step];

  const { data: pkg, isLoading } = useQuery<Package>({
    queryKey: ["/api/packages", packageId],
    enabled: !!packageId,
  });

  const mobileForm = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { mobile: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (data: { mobile: string }) => {
      const res = await apiRequest("POST", "/api/auth/send-otp", data);
      return res.json();
    },
    onSuccess: () => {
      setMobile(mobileForm.getValues("mobile"));
      setStep("otp");
      toast({
        title: "OTP Sent",
        description: "A verification code has been sent to your mobile (use 79 for testing)",
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

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/purchases", {
        mobile,
        packageId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPurchaseId(data.id);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
    },
    onError: () => {
      toast({
        title: "Payment Failed",
        description: "Unable to process payment. Please try again.",
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
    purchaseMutation.mutate();
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
                  if (step === "mobile") navigate(`/package/${packageId}`);
                  else if (step === "otp") setStep("mobile");
                  else if (step === "payment") setStep("otp");
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
                  <p className="text-center text-sm text-muted-foreground">
                    Use <Badge variant="secondary">79</Badge> for testing
                  </p>
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
        {step === "payment" && (
          <div className="space-y-6" data-testid="step-payment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment
                </CardTitle>
                <CardDescription>
                  Complete your purchase
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="font-medium mb-2">{pkg.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {pkg.services.length} services • {pkg.validityMonths} months validity • {pkg.adultsCount} Adults, {pkg.kidsCount} Kids
                  </p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="text-xl font-bold">{formatPrice(pkg.price)}</span>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    This is a demo payment page. Click the button below to simulate a successful payment.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full h-12"
              onClick={handlePayment}
              disabled={purchaseMutation.isPending}
              data-testid="button-pay"
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Pay {formatPrice(pkg.price)}
            </Button>
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
    </div>
  );
}
