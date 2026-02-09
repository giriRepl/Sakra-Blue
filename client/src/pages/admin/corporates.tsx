import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Plus,
  Users,
  Upload,
  Trash2,
  Loader2,
  Phone,
  Mail,
  User,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminLayout } from "@/components/admin-layout";
import { LoadingCard, LoadingPage } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAdminAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Package as PackageType, CorporateWithDetails, CorporateEmployee } from "@shared/schema";

const corporateFormSchema = z.object({
  name: z.string().min(1, "Corporate name is required"),
  contactPerson: z.string().min(1, "Contact person name is required"),
  email: z.string().email("Valid email is required"),
  mobile: z.string().regex(/^[0-9]{10}$/, "Valid 10-digit mobile number required"),
  packageId: z.string().min(1, "Please select a package"),
});

type CorporateFormData = z.infer<typeof corporateFormSchema>;

type CorporateDetailData = CorporateWithDetails & {
  employees: CorporateEmployee[];
};

export default function AdminCorporatesPage() {
  const [, navigate] = useLocation();
  const { token, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedCorporate, setExpandedCorporate] = useState<string | null>(null);
  const [uploadCorporateId, setUploadCorporateId] = useState<string | null>(null);
  const [deleteCorporateId, setDeleteCorporateId] = useState<string | null>(null);
  const [parsedEmployees, setParsedEmployees] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CorporateFormData>({
    resolver: zodResolver(corporateFormSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      mobile: "",
      packageId: "",
    },
  });

  const { data: corporates, isLoading: corporatesLoading } = useQuery<CorporateWithDetails[]>({
    queryKey: ["/api/admin/corporates"],
    enabled: !!token,
  });

  const { data: allPackages } = useQuery<PackageType[]>({
    queryKey: ["/api/packages"],
    enabled: !!token,
  });

  const { data: corporateDetail } = useQuery<CorporateDetailData>({
    queryKey: ["/api/admin/corporates", expandedCorporate],
    enabled: !!expandedCorporate && !!token,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CorporateFormData) => {
      const res = await apiRequest("POST", "/api/admin/corporates", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Corporate Added", description: "Corporate has been onboarded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/corporates"] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add corporate", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/corporates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Corporate has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/corporates"] });
      setDeleteCorporateId(null);
      if (expandedCorporate === deleteCorporateId) {
        setExpandedCorporate(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete corporate", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ corporateId, employees }: { corporateId: string; employees: any[] }) => {
      const res = await apiRequest("POST", `/api/admin/corporates/${corporateId}/employees`, { employees });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Employees Uploaded", description: `${data.count} employees added successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/corporates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/corporates", uploadCorporateId] });
      setUploadCorporateId(null);
      setParsedEmployees([]);
      setUploadError("");
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload employees", variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length < 2) {
          setUploadError("File must have a header row and at least one data row");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = headers.findIndex((h) => h === "name" || h === "employee name");
        const mobileIdx = headers.findIndex((h) => h === "mobile" || h === "phone" || h === "mobile number");
        const emailIdx = headers.findIndex((h) => h === "email" || h === "email id");
        const empIdIdx = headers.findIndex((h) => h === "employee id" || h === "emp id" || h === "employeeid");

        if (nameIdx === -1) {
          setUploadError("CSV must have a 'Name' column");
          return;
        }
        if (mobileIdx === -1) {
          setUploadError("CSV must have a 'Mobile' column");
          return;
        }

        const employees = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim());
          const name = cols[nameIdx] || "";
          const mobile = cols[mobileIdx]?.replace(/\D/g, "").slice(-10) || "";
          const email = emailIdx >= 0 ? cols[emailIdx] : "";
          const employeeId = empIdIdx >= 0 ? cols[empIdIdx] : "";

          if (name && mobile) {
            employees.push({ name, mobile, email, employeeId });
          }
        }

        if (employees.length === 0) {
          setUploadError("No valid employee records found in the file");
          return;
        }

        setParsedEmployees(employees);
      } catch {
        setUploadError("Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (data: CorporateFormData) => {
    createMutation.mutate(data);
  };

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!token) {
    navigate("/admin/login");
    return null;
  }

  return (
    <AdminLayout title="Corporate Onboarding">
      <div data-testid="page-admin-corporates">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <p className="text-muted-foreground">
            Manage corporate partnerships and employee lists
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-corporate">
            <Plus className="h-4 w-4 mr-2" />
            Add Corporate
          </Button>
        </div>

        {corporatesLoading ? (
          <div className="space-y-4">
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : corporates && corporates.length > 0 ? (
          <div className="space-y-4">
            {corporates.map((corp) => {
              const isExpanded = expandedCorporate === corp.id;
              return (
                <Card key={corp.id} data-testid={`card-corporate-${corp.id}`}>
                  <CardContent className="p-0">
                    <div
                      className="flex items-center justify-between gap-4 p-4 cursor-pointer"
                      onClick={() => setExpandedCorporate(isExpanded ? null : corp.id)}
                      data-testid={`toggle-corporate-${corp.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{corp.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {corp.contactPerson} | {corp.package.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" data-testid={`badge-employee-count-${corp.id}`}>
                          <Users className="h-3 w-3 mr-1" />
                          {corp.employeeCount} employees
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCorporateId(corp.id);
                          }}
                          data-testid={`button-delete-corporate-${corp.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <Separator />
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Contact:</span>
                              <span className="font-medium">{corp.contactPerson}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Email:</span>
                              <span className="font-medium truncate">{corp.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Mobile:</span>
                              <span className="font-medium">{corp.mobile}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Package:</span>
                              <Badge variant="outline">{corp.package.title}</Badge>
                            </div>
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between gap-4">
                            <h4 className="font-semibold text-sm">
                              Employees ({corporateDetail?.employees?.length ?? corp.employeeCount})
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setUploadCorporateId(corp.id);
                                setParsedEmployees([]);
                                setUploadError("");
                              }}
                              data-testid={`button-upload-employees-${corp.id}`}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Employees
                            </Button>
                          </div>

                          {corporateDetail?.employees && corporateDetail.employees.length > 0 ? (
                            <div className="rounded-md border overflow-auto max-h-64">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Employee ID</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {corporateDetail.employees.map((emp, idx) => (
                                    <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                      <TableCell className="font-medium">{emp.name}</TableCell>
                                      <TableCell>{emp.mobile}</TableCell>
                                      <TableCell className="text-muted-foreground">{emp.email || "-"}</TableCell>
                                      <TableCell className="text-muted-foreground">{emp.employeeId || "-"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-sm text-muted-foreground">
                              No employees uploaded yet. Click "Upload Employees" to add them.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="building"
            title="No corporates onboarded"
            description="Add your first corporate partner to get started"
          />
        )}

        {/* Add Corporate Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Corporate</DialogTitle>
              <DialogDescription>
                Onboard a new corporate partner
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corporate Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} data-testid="input-corporate-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} data-testid="input-contact-person" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email ID</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@acme.com" {...field} data-testid="input-corporate-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="9876543210" maxLength={10} {...field} data-testid="input-corporate-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="packageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Selected</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-corporate-package">
                            <SelectValue placeholder="Select a package" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allPackages?.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.title} - Rs.{pkg.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      form.reset();
                    }}
                    data-testid="button-cancel-corporate"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-corporate">
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Corporate
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Upload Employees Dialog */}
        <Dialog open={!!uploadCorporateId} onOpenChange={(open) => { if (!open) { setUploadCorporateId(null); setParsedEmployees([]); setUploadError(""); } }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Employee List</DialogTitle>
              <DialogDescription>
                Upload a CSV file with employee details. Required columns: Name, Mobile. Optional: Email, Employee ID.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  data-testid="input-upload-csv"
                />
              </div>

              <div className="rounded-md border border-dashed p-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Expected CSV format:</p>
                <code className="text-xs text-muted-foreground block">
                  Name,Mobile,Email,Employee ID<br />
                  John Doe,9876543210,john@email.com,EMP001
                </code>
              </div>

              {uploadError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3" data-testid="text-upload-error">
                  {uploadError}
                </div>
              )}

              {parsedEmployees.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                      {parsedEmployees.length} employees found
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setParsedEmployees([])}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedEmployees.map((emp, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>{emp.name}</TableCell>
                            <TableCell>{emp.mobile}</TableCell>
                            <TableCell className="text-muted-foreground">{emp.email || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUploadCorporateId(null);
                  setParsedEmployees([]);
                  setUploadError("");
                }}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                disabled={parsedEmployees.length === 0 || uploadMutation.isPending}
                onClick={() => {
                  if (uploadCorporateId) {
                    uploadMutation.mutate({ corporateId: uploadCorporateId, employees: parsedEmployees });
                  }
                }}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload {parsedEmployees.length} Employees
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteCorporateId} onOpenChange={(open) => { if (!open) setDeleteCorporateId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Corporate?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this corporate and all its employee records. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteCorporateId) {
                    deleteMutation.mutate(deleteCorporateId);
                  }
                }}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
