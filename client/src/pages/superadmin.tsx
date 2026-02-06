import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Lock, Loader2, ArrowLeft, MessageSquare, Send, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const PASSCODE = "7999";

const passcodeSchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
});

const smsSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  message: z.string().min(1, "Message is required"),
});

function SuperAdminLogin({ onLogin }: { onLogin: () => void }) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof passcodeSchema>>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const handleSubmit = (data: z.infer<typeof passcodeSchema>) => {
    if (data.passcode === PASSCODE) {
      onLogin();
    } else {
      toast({
        title: "Invalid Passcode",
        description: "The passcode you entered is incorrect.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-superadmin-login">
      <header className="border-b">
        <div className="mx-auto max-w-md px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <span className="font-semibold">Super Admin</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src="/favicon.png" alt="Sakra Logo" className="h-16 w-16 mb-4" />
            <h1 className="text-2xl font-bold">Super Admin Access</h1>
            <p className="text-muted-foreground">Enter passcode to continue</p>
          </div>

          <Card data-testid="card-passcode-form">
            <CardHeader>
              <CardTitle>Passcode</CardTitle>
              <CardDescription>Enter the super admin passcode</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="passcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passcode</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter passcode"
                              className="h-12 pl-10"
                              data-testid="input-passcode"
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
                    data-testid="button-login"
                  >
                    Access Panel
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function SMSPage() {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const form = useForm<z.infer<typeof smsSchema>>({
    resolver: zodResolver(smsSchema),
    defaultValues: { mobile: "", message: "" },
  });

  const handleSubmit = (data: z.infer<typeof smsSchema>) => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      toast({
        title: "SMS Sent Successfully",
        description: `Message sent to ${data.mobile}`,
      });
      form.reset();
    }, 800);
  };

  return (
    <div className="max-w-lg">
      <Card data-testid="card-sms-form">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS
          </CardTitle>
          <CardDescription>Send an SMS message to a mobile number</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="tel"
                          maxLength={10}
                          placeholder="Enter 10-digit mobile number"
                          className="h-12 pl-10"
                          data-testid="input-mobile"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter your message here..."
                        rows={5}
                        className="resize-none"
                        data-testid="input-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12"
                disabled={isSending}
                data-testid="button-send-sms"
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send SMS
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function SuperAdminPanel({ onLogout }: { onLogout: () => void }) {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" data-testid="superadmin-layout">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="Sakra Logo" className="h-9 w-9" />
              <div>
                <span className="font-bold text-sidebar-foreground">Sakra IKOC</span>
                <p className="text-xs text-sidebar-foreground/70">Super Admin</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive data-testid="nav-sms">
                  <MessageSquare className="h-4 w-4" />
                  <span>SMS</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onLogout}
              data-testid="button-logout"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </div>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-16 items-center justify-between gap-4 border-b px-4 lg:px-6 shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-xl font-semibold">SMS</h1>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">
              <SMSPage />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function SuperAdminPage() {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <SuperAdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  return <SuperAdminPanel onLogout={() => setAuthenticated(false)} />;
}
