import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { CustomerAuthProvider, AdminAuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/landing";
import PackageDetailsPage from "@/pages/package-details";
import PurchaseFlowPage from "@/pages/purchase-flow";
import CustomerLoginPage from "@/pages/customer-login";
import CustomerDashboardPage from "@/pages/customer-dashboard";

import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminPackagesPage from "@/pages/admin/packages";
import PackageFormPage from "@/pages/admin/package-form";
import PackageViewPage from "@/pages/admin/package-view";
import AdminRedeemPage from "@/pages/admin/redeem";
import AdminAssignPage from "@/pages/admin/assign";
import AdminCorporatesPage from "@/pages/admin/corporates";
import AdminBusinessPage from "@/pages/admin/business";
import SuperAdminPage from "@/pages/superadmin";

function Router() {
  return (
    <Switch>
      {/* Customer Routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/package/:id" component={PackageDetailsPage} />
      <Route path="/buy/:id" component={PurchaseFlowPage} />
      <Route path="/login" component={CustomerLoginPage} />
      <Route path="/dashboard" component={CustomerDashboardPage} />

      {/* Admin Routes */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/packages" component={AdminPackagesPage} />
      <Route path="/admin/packages/new" component={PackageFormPage} />
      <Route path="/admin/packages/:id" component={PackageViewPage} />
      <Route path="/admin/packages/:id/edit" component={PackageFormPage} />
      <Route path="/admin/redeem" component={AdminRedeemPage} />
      <Route path="/admin/assign" component={AdminAssignPage} />
      <Route path="/admin/corporates" component={AdminCorporatesPage} />
      <Route path="/admin/business" component={AdminBusinessPage} />

      {/* Super Admin Routes */}
      <Route path="/superadmin" component={SuperAdminPage} />

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CustomerAuthProvider>
          <AdminAuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AdminAuthProvider>
        </CustomerAuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
