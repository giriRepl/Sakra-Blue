import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Lock, Loader2, ArrowLeft, MessageSquare, Send, Phone, FileText, Plus, Pencil, Trash2, X, Save, AlertTriangle, ClipboardList, ChevronLeft, ChevronRight, Mail, Settings, ShoppingCart, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { SmsTemplate, SmsFailureLog, SmsLog } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const SUPERADMIN_PASSCODE = "7999";

const passcodeSchema = z.object({
  passcode: z.string().min(1, "Passcode is required"),
});

const smsSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  message: z.string().min(1, "Message is required"),
});

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  text: z.string().min(1, "Template text is required"),
  templateId: z.string().min(1, "DLT Template ID is required"),
});

function superAdminFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-superadmin-passcode": SUPERADMIN_PASSCODE,
      ...options.headers,
    },
  });
}

function SuperAdminLogin({ onLogin }: { onLogin: () => void }) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof passcodeSchema>>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { passcode: "" },
  });

  const handleSubmit = (data: z.infer<typeof passcodeSchema>) => {
    if (data.passcode === SUPERADMIN_PASSCODE) {
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

  const form = useForm<z.infer<typeof smsSchema>>({
    resolver: zodResolver(smsSchema),
    defaultValues: { mobile: "", message: "" },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof smsSchema>) => {
      const res = await superAdminFetch("/api/superadmin/send-sms", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Failed to send SMS");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS Sent Successfully",
        description: data.message || "Message delivered",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "SMS Failed",
        description: error.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: z.infer<typeof smsSchema>) => {
    sendSmsMutation.mutate(data);
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
                disabled={sendSmsMutation.isPending}
                data-testid="button-send-sms"
              >
                {sendSmsMutation.isPending ? (
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

function TemplatesPage() {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testTemplate, setTestTemplate] = useState<SmsTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<SmsTemplate[]>({
    queryKey: ["/api/superadmin/sms-templates"],
    queryFn: async () => {
      const res = await superAdminFetch("/api/superadmin/sms-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof templateSchema>) => {
      const res = await superAdminFetch("/api/superadmin/sms-templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/sms-templates"] });
      setShowCreateDialog(false);
      toast({ title: "Template Created", description: "SMS template has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof templateSchema> }) => {
      const res = await superAdminFetch(`/api/superadmin/sms-templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/sms-templates"] });
      setEditingTemplate(null);
      toast({ title: "Template Updated", description: "SMS template has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update template.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await superAdminFetch(`/api/superadmin/sms-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/sms-templates"] });
      setDeleteConfirmId(null);
      toast({ title: "Template Deleted", description: "SMS template has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-templates-heading">SMS Templates</h2>
          <p className="text-sm text-muted-foreground">Manage DLT-compliant SMS templates</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-template">
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card data-testid="card-no-templates">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No templates yet. Create your first SMS template.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} data-testid={`card-template-${template.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" data-testid={`text-template-name-${template.id}`}>{template.name}</span>
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-template-id-${template.id}`}>
                        {template.templateId}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words" data-testid={`text-template-text-${template.id}`}>
                      {template.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTestTemplate(template)}
                      data-testid={`button-test-template-${template.id}`}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTemplate(template)}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(template.id)}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="Create SMS Template"
        description="Add a new DLT-compliant SMS template. The text must exactly match the DLT platform registration."
      />

      {editingTemplate && (
        <TemplateFormDialog
          key={editingTemplate.id}
          open={true}
          onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}
          onSubmit={(data) => updateMutation.mutate({ id: editingTemplate.id, data })}
          isPending={updateMutation.isPending}
          title="Edit SMS Template"
          description="Update the SMS template. The text must exactly match the DLT platform registration."
          defaultValues={{ name: editingTemplate.name, text: editingTemplate.text, templateId: editingTemplate.templateId }}
        />
      )}

      {testTemplate && (
        <TestSmsDialog
          key={testTemplate.id}
          template={testTemplate}
          open={true}
          onOpenChange={(open) => { if (!open) setTestTemplate(null); }}
        />
      )}

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>Are you sure you want to delete this SMS template? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  title,
  description,
  defaultValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: z.infer<typeof templateSchema>) => void;
  isPending: boolean;
  title: string;
  description: string;
  defaultValues?: z.infer<typeof templateSchema>;
}) {
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: defaultValues || { name: "", text: "", templateId: "" },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset(defaultValues || { name: "", text: "", templateId: "" });
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. OTP Verification" data-testid="input-template-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DLT Template ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. 1107161234567890123" data-testid="input-template-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Text</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter exact DLT-registered template text..."
                      rows={5}
                      className="resize-none font-mono text-sm"
                      data-testid="input-template-text"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Must be an exact character-to-character match with the DLT platform registration.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-template">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-template">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{#[^#}]+#\}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function TestSmsDialog({
  template,
  open,
  onOpenChange,
}: {
  template: SmsTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const placeholders = extractPlaceholders(template.text);
  const [mobile, setMobile] = useState("");
  const [replacements, setReplacements] = useState<Record<string, string>>(
    () => Object.fromEntries(placeholders.map((p) => [p, ""]))
  );
  const [sending, setSending] = useState(false);

  const buildMessage = () => {
    let msg = template.text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      msg = msg.replaceAll(placeholder, value || placeholder);
    }
    return msg;
  };

  const updateReplacement = (placeholder: string, value: string) => {
    setReplacements((prev) => ({ ...prev, [placeholder]: value }));
  };

  const handleSend = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast({ title: "Invalid Mobile", description: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }

    const emptyPlaceholders = placeholders.filter((p) => !replacements[p]?.trim());
    if (emptyPlaceholders.length > 0) {
      toast({ title: "Missing Values", description: "Please fill in all placeholder values", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const message = buildMessage();
      const res = await superAdminFetch("/api/superadmin/send-sms", {
        method: "POST",
        body: JSON.stringify({ mobile, message, templateId: template.templateId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Test SMS Sent", description: `SMS sent to ${mobile}` });
        onOpenChange(false);
      } else {
        toast({ title: "SMS Failed", description: data.error || "Failed to send SMS", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send test SMS", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const currentMessage = buildMessage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Test SMS
          </DialogTitle>
          <DialogDescription>
            Send a test SMS using the <span className="font-medium text-foreground">{template.name}</span> template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mobile Number</label>
            <Input
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9876543210"
              maxLength={10}
              data-testid="input-test-sms-mobile"
            />
          </div>

          {placeholders.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Placeholder Values</label>
              {placeholders.map((placeholder) => {
                const label = placeholder.replace(/^\{#/, "").replace(/#\}$/, "");
                return (
                  <div key={placeholder} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{placeholder}</label>
                    <Input
                      value={replacements[placeholder] || ""}
                      onChange={(e) => updateReplacement(placeholder, e.target.value)}
                      placeholder={`Enter value for ${label}`}
                      data-testid={`input-test-placeholder-${label}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Message Preview</label>
            <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap break-words" data-testid="text-test-sms-preview">
              {currentMessage}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-test-sms">
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending} data-testid="button-confirm-test-sms">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Test SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FailureLogsPage() {
  const { data: logs = [], isLoading } = useQuery<SmsFailureLog[]>({
    queryKey: ["/api/superadmin/sms-failure-logs"],
    queryFn: async () => {
      const res = await superAdminFetch("/api/superadmin/sms-failure-logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="loading-failure-logs">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl" data-testid="page-failure-logs">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            SMS Failure Logs
          </CardTitle>
          <CardDescription>
            {logs.length === 0
              ? "No SMS failures recorded yet."
              : `${logs.length} failure${logs.length === 1 ? "" : "s"} recorded`}
          </CardDescription>
        </CardHeader>
        {logs.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="th-datetime">Date &amp; Time</TableHead>
                  <TableHead data-testid="th-mobile">Mobile (last 4)</TableHead>
                  <TableHead data-testid="th-reason">Failure Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-failure-${log.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground" data-testid={`cell-datetime-${log.id}`}>
                      {formatDate(log.createdAt as unknown as string)}
                    </TableCell>
                    <TableCell data-testid={`cell-mobile-${log.id}`}>
                      <Badge variant="outline">****{log.mobileLast4}</Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-reason-${log.id}`}>{log.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function SmsLogsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery<{ logs: SmsLog[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/superadmin/sms-logs", page],
    queryFn: async () => {
      const res = await superAdminFetch(`/api/superadmin/sms-logs?page=${page}&limit=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch SMS logs");
      return res.json();
    },
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="loading-sms-logs">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="page-sms-logs">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            SMS Logs
          </CardTitle>
          <CardDescription>
            {total === 0
              ? "No SMS logs recorded yet."
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} message${total === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        {logs.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="th-date">Date</TableHead>
                  <TableHead data-testid="th-time">Time</TableHead>
                  <TableHead data-testid="th-destination">Destination</TableHead>
                  <TableHead data-testid="th-template-id">Template ID</TableHead>
                  <TableHead data-testid="th-sms-text">SMS Text</TableHead>
                  <TableHead data-testid="th-status">Status</TableHead>
                  <TableHead data-testid="th-server">Server</TableHead>
                  <TableHead data-testid="th-api-result">API Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-smslog-${log.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground" data-testid={`cell-date-${log.id}`}>
                      {formatDate(log.createdAt as unknown as string)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground" data-testid={`cell-time-${log.id}`}>
                      {formatTime(log.createdAt as unknown as string)}
                    </TableCell>
                    <TableCell data-testid={`cell-destination-${log.id}`}>
                      {log.mobile}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono" data-testid={`cell-template-id-${log.id}`}>
                      {log.templateId || "-"}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`cell-text-${log.id}`}>
                      {log.message}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${log.id}`}>
                      <Badge variant={log.status === "sent" ? "default" : "destructive"} className="text-xs">
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-server-${log.id}`}>
                      {log.serverUsed ? (
                        <Badge
                          variant={log.serverUsed === "primary" ? "outline" : log.serverUsed === "secondary" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {log.serverUsed === "both_failed" ? "Both Failed" : log.serverUsed === "primary" ? "Primary" : "Secondary"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs" data-testid={`cell-api-result-${log.id}`}>
                      {log.apiResponse || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-4 border-t mt-4">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function EmailTestPage() {
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailMethod, setEmailMethod] = useState<"auto" | "smtp" | "ews">("auto");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const healthQuery = useQuery<{ smtp: { configured: boolean; connected?: boolean; error?: string }; ews: { configured: boolean } }>({
    queryKey: ["/api/superadmin/email-health"],
    queryFn: async () => {
      const res = await superAdminFetch("/api/superadmin/email-health");
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { to: emailTo, subject: emailSubject, body: emailBody };
      if (emailMethod !== "auto") payload.method = emailMethod;
      const res = await superAdminFetch("/api/superadmin/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      return data;
    },
    onSuccess: (data) => {
      const method = data.method ? ` via ${data.method.toUpperCase()}` : "";
      setResult({ type: "success", message: `Email sent successfully${method}! ${data.details || ""}` });
    },
    onError: (err: any) => {
      setResult({ type: "error", message: err.message || "Failed to send email" });
    },
  });

  return (
    <div className="max-w-2xl space-y-6" data-testid="page-email-test">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Health
          </CardTitle>
          <CardDescription>Status of configured email routes.</CardDescription>
        </CardHeader>
        <CardContent>
          {healthQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking...</p>
          ) : healthQuery.data ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${healthQuery.data.smtp.configured ? (healthQuery.data.smtp.connected ? "bg-green-500" : "bg-yellow-500") : "bg-gray-300"}`} />
                <span className="font-medium">SMTP:</span>
                <span className="text-muted-foreground">
                  {!healthQuery.data.smtp.configured
                    ? "Not configured"
                    : healthQuery.data.smtp.connected
                      ? "Connected"
                      : `Configured but connection failed${healthQuery.data.smtp.error ? ` (${healthQuery.data.smtp.error})` : ""}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${healthQuery.data.ews.configured ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="font-medium">EWS:</span>
                <span className="text-muted-foreground">
                  {healthQuery.data.ews.configured ? "Configured" : "Not configured"}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Email
          </CardTitle>
          <CardDescription>Send a test email using SMTP (primary) or EWS (fallback). Auto mode tries SMTP first, then falls back to EWS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Send Method</label>
            <div className="flex gap-2">
              {(["auto", "smtp", "ews"] as const).map((m) => (
                <Button
                  key={m}
                  variant={emailMethod === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEmailMethod(m)}
                  data-testid={`button-method-${m}`}
                >
                  {m === "auto" ? "Auto (SMTP → EWS)" : m.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email-to">To (Email Address)</label>
            <Input
              id="email-to"
              type="email"
              placeholder="recipient@example.com"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              data-testid="input-email-to"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email-subject">Subject</label>
            <Input
              id="email-subject"
              placeholder="Test email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              data-testid="input-email-subject"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email-body">Body</label>
            <Textarea
              id="email-body"
              placeholder="Enter email body (HTML supported)"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              data-testid="input-email-body"
            />
          </div>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!emailTo || !emailSubject || !emailBody || sendMutation.isPending}
            data-testid="button-send-email"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Test Email
          </Button>
          {result && (
            <div
              className={`p-3 rounded-md text-sm ${result.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
              data-testid="email-result"
            >
              {result.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigurationPage() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/superadmin/config"],
    queryFn: async () => {
      const res = await superAdminFetch("/api/superadmin/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await superAdminFetch("/api/superadmin/config", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Failed to update config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/edit-after-publish"] });
      toast({ title: "Configuration Updated", description: "Setting has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update configuration.", variant: "destructive" });
    },
  });

  const editAfterPublish = config?.edit_after_publish === "true";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-config-edit-after-publish">
        <CardHeader>
          <CardTitle>Package Editing</CardTitle>
          <CardDescription>Control whether published packages with purchases can be edited</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <p className="font-medium">Edit after publish</p>
              <p className="text-sm text-muted-foreground">
                When enabled, admins can edit published packages even after customers have purchased them. When disabled, packages with purchases are locked and can only be cloned.
              </p>
            </div>
            <Switch
              checked={editAfterPublish}
              onCheckedChange={(checked) => {
                toggleMutation.mutate({ key: "edit_after_publish", value: String(checked) });
              }}
              disabled={toggleMutation.isPending}
              data-testid="switch-edit-after-publish"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AllPurchasesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 20;

  const { data, isLoading } = useQuery<{ purchases: any[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/superadmin/purchases", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) params.set("search", search);
      const res = await superAdminFetch(`/api/superadmin/purchases?${params}`);
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return res.json();
    },
  });

  const purchasesList = data?.purchases ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  };

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="loading-purchases">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="page-all-purchases">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            All Purchases
          </CardTitle>
          <CardDescription>
            {total === 0
              ? "No purchases recorded yet."
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} purchase${total === 1 ? "" : "s"}`}
          </CardDescription>
          <div className="flex items-center gap-2 pt-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by mobile, receipt, or payment ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
                data-testid="input-purchase-search"
              />
            </div>
            <Button onClick={handleSearch} size="sm" data-testid="button-purchase-search">
              Search
            </Button>
            {search && (
              <Button onClick={handleClearSearch} variant="ghost" size="sm" data-testid="button-purchase-clear-search">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        {purchasesList.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="th-purchase-date">Date</TableHead>
                  <TableHead data-testid="th-purchase-time">Time</TableHead>
                  <TableHead data-testid="th-purchase-mobile">Mobile</TableHead>
                  <TableHead data-testid="th-purchase-name">Name</TableHead>
                  <TableHead data-testid="th-purchase-plan">Plan (People)</TableHead>
                  <TableHead data-testid="th-purchase-receipt">Razorpay Receipt</TableHead>
                  <TableHead data-testid="th-purchase-payment-id">Payment ID</TableHead>
                  <TableHead data-testid="th-purchase-amount">Amount</TableHead>
                  <TableHead data-testid="th-purchase-status">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchasesList.map((p: any) => (
                  <TableRow key={p.id} data-testid={`row-purchase-${p.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground" data-testid={`cell-purchase-date-${p.id}`}>
                      {formatDate(p.purchaseDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground" data-testid={`cell-purchase-time-${p.id}`}>
                      {formatTime(p.purchaseDate)}
                    </TableCell>
                    <TableCell data-testid={`cell-purchase-mobile-${p.id}`}>
                      {p.mobile}
                    </TableCell>
                    <TableCell data-testid={`cell-purchase-name-${p.id}`}>
                      {p.customerName}
                    </TableCell>
                    <TableCell data-testid={`cell-purchase-plan-${p.id}`}>
                      <span className="font-medium">{p.packageTitle}</span>
                      {p.numPeople !== null && (
                        <span className="text-muted-foreground text-xs ml-1">({p.numPeople})</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs" data-testid={`cell-purchase-receipt-${p.id}`}>
                      {p.razorpayReceipt}
                    </TableCell>
                    <TableCell className="font-mono text-xs" data-testid={`cell-purchase-paymentid-${p.id}`}>
                      {p.razorpayPaymentId}
                    </TableCell>
                    <TableCell className="whitespace-nowrap" data-testid={`cell-purchase-amount-${p.id}`}>
                      INR {p.amountPaid?.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell data-testid={`cell-purchase-status-${p.id}`}>
                      <Badge
                        variant={p.paymentStatus === "captured" ? "default" : p.paymentStatus === "pending" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {p.paymentStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-4 border-t mt-4">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    data-testid="button-purchases-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    data-testid="button-purchases-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function SuperAdminPanel({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<"sms" | "templates" | "sms-logs" | "failure-logs" | "email" | "config" | "purchases">("sms");

  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  const pageTitles: Record<string, string> = {
    sms: "SMS",
    templates: "Templates",
    "sms-logs": "SMS Logs",
    "failure-logs": "Failure Logs",
    email: "Email",
    config: "Configuration",
    purchases: "All Purchases",
  };
  const pageTitle = pageTitles[activeTab] || "Super Admin";

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
                <SidebarMenuButton isActive={activeTab === "sms"} onClick={() => setActiveTab("sms")} data-testid="nav-sms">
                  <MessageSquare className="h-4 w-4" />
                  <span>SMS</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "templates"} onClick={() => setActiveTab("templates")} data-testid="nav-templates">
                  <FileText className="h-4 w-4" />
                  <span>Templates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "sms-logs"} onClick={() => setActiveTab("sms-logs")} data-testid="nav-sms-logs">
                  <ClipboardList className="h-4 w-4" />
                  <span>SMS Logs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "failure-logs"} onClick={() => setActiveTab("failure-logs")} data-testid="nav-failure-logs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Failure Logs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "email"} onClick={() => setActiveTab("email")} data-testid="nav-email">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "purchases"} onClick={() => setActiveTab("purchases")} data-testid="nav-purchases">
                  <ShoppingCart className="h-4 w-4" />
                  <span>All Purchases</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "config"} onClick={() => setActiveTab("config")} data-testid="nav-config">
                  <Settings className="h-4 w-4" />
                  <span>Configuration</span>
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
              <h1 className="text-xl font-semibold">{pageTitle}</h1>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">
              {activeTab === "sms" && <SMSPage />}
              {activeTab === "templates" && <TemplatesPage />}
              {activeTab === "sms-logs" && <SmsLogsPage />}
              {activeTab === "failure-logs" && <FailureLogsPage />}
              {activeTab === "email" && <EmailTestPage />}
              {activeTab === "purchases" && <AllPurchasesPage />}
              {activeTab === "config" && <ConfigurationPage />}
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
