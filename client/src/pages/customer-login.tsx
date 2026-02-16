import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Phone, Shield, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const mobileSchema = z.object({
  mobile: z.string().regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"),
});

const otpSchema = z.object({
  otp: z.string().length(4, "Please enter the complete OTP"),
});

export default function CustomerLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useCustomerAuth();
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");

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
    onSuccess: (data) => {
      setMobile(mobileForm.getValues("mobile"));
      setStep("otp");
      toast({
        title: "OTP Sent",
        description: "Please check your phone for the OTP",
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
      const res = await apiRequest("POST", "/api/auth/customer-login", data);
      return res.json();
    },
    onSuccess: (data) => {
      login(data.customer, data.token);
      toast({
        title: "Welcome!",
        description: "You have successfully logged in.",
      });
      navigate("/dashboard");
    },
    onError: () => {
      toast({
        title: "Invalid OTP",
        description: "Please check the OTP and try again.",
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

  return (
    <div className="min-h-screen bg-background" data-testid="page-customer-login">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (step === "mobile") navigate("/");
                else setStep("mobile");
              }}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold">Login</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.png" alt="Sakra Logo" className="h-16 w-16 mb-4" />
          <h1 className="text-2xl font-bold">Sakra IKOC</h1>
          <p className="text-muted-foreground">Access your health card</p>
        </div>

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
                    Continue
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
                            maxLength={4}
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-otp"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground text-center">An OTP has been sent to your mobile number via SMS</p>
                  <Button
                    type="submit"
                    className="w-full h-12"
                    disabled={verifyOtpMutation.isPending}
                    data-testid="button-verify-otp"
                  >
                    {verifyOtpMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verify & Login
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have a card?{" "}
          <Link href="/" className="text-primary font-medium hover:underline">
            Browse Packages
          </Link>
        </p>
      </main>
    </div>
  );
}
