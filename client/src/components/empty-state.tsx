import { Package, ShoppingCart, Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: "package" | "cart" | "users" | "activity";
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const icons = {
  package: Package,
  cart: ShoppingCart,
  users: Users,
  activity: Activity,
};

export function EmptyState({ icon = "package", title, description, action, className }: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)} data-testid="empty-state">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
