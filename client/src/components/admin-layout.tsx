import { useLocation, Link } from "wouter";
import { Home, Package, Gift, LogOut, UserPlus, Building2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAdminAuth } from "@/lib/auth";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const menuItems = [
  { title: "Home", href: "/admin", icon: Home },
  { title: "Packages", href: "/admin/packages", icon: Package },
  { title: "Assign Package", href: "/admin/assign", icon: UserPlus },
  { title: "Redeem Services", href: "/admin/redeem", icon: Gift },
  { title: "Corporate Onboarding", href: "/admin/corporates", icon: Building2 },
];

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { admin, logout } = useAdminAuth();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" data-testid="admin-layout">
        <Sidebar>
          <SidebarHeader className="p-4">
            <Link href="/admin" className="flex items-center gap-2">
              <img src="/favicon.png" alt="Sakra Logo" className="h-9 w-9" />
              <div>
                <span className="font-bold text-sidebar-foreground">Sakra IKOC</span>
                <p className="text-xs text-sidebar-foreground/70">Admin Panel</p>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.href || 
                  (item.href !== "/admin" && location.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-sm font-medium">
                {admin?.email?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {admin?.email || "Admin"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-sidebar-foreground shrink-0"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-16 items-center justify-between gap-4 border-b px-4 lg:px-6 shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-xl font-semibold">{title}</h1>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
