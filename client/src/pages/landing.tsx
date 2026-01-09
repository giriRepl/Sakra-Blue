import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Clock, Users, Shield, ChevronRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCustomerAuth } from "@/lib/auth";
import type { Package } from "@shared/schema";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price / 100);
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { customer, token } = useCustomerAuth();

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages/active"],
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-landing">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="Sakra Logo" className="h-9 w-9" />
              <span className="text-xl font-bold tracking-tight">Sakra IKOC</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {customer && token ? (
                <Button 
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-dashboard"
                >
                  My Card
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => navigate("/login")}
                  data-testid="button-login"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4" data-testid="badge-hero">
              Healthcare Packages
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your Health, <span className="text-primary">Bundled Right</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Premium healthcare packages combining lab tests, consultations, and therapy sessions. 
              One card, multiple services, complete care.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button 
                size="lg" 
                onClick={() => document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" })}
                data-testid="button-view-packages"
              >
                View Packages
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              {!customer && (
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/login")}
                  data-testid="button-hero-login"
                >
                  Already have a card?
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="border-y bg-muted/30 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex items-center gap-4" data-testid="trust-indicator-validity">
              <div className="rounded-full bg-primary/10 p-3">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Flexible Validity</p>
                <p className="text-sm text-muted-foreground">Use services at your pace</p>
              </div>
            </div>
            <div className="flex items-center gap-4" data-testid="trust-indicator-consultations">
              <div className="rounded-full bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Expert Consultations</p>
                <p className="text-sm text-muted-foreground">Top medical professionals</p>
              </div>
            </div>
            <div className="flex items-center gap-4" data-testid="trust-indicator-trusted">
              <div className="rounded-full bg-primary/10 p-3">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Trusted Care</p>
                <p className="text-sm text-muted-foreground">Quality healthcare assured</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="packages" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Choose Your Package
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comprehensive healthcare bundles designed for your complete wellness
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : packages && packages.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card key={pkg.id} className="flex flex-col hover-elevate" data-testid={`card-package-${pkg.id}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl">{pkg.title}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {pkg.services.length} services
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {pkg.description}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-3">
                      {pkg.services.slice(0, 3).map((service) => (
                        <div key={service.id} className="flex items-center gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>{service.name}</span>
                          {service.quantity > 1 && (
                            <Badge variant="outline" className="text-xs ml-auto">
                              x{service.quantity}
                            </Badge>
                          )}
                        </div>
                      ))}
                      {pkg.services.length > 3 && (
                        <p className="text-sm text-muted-foreground">
                          +{pkg.services.length - 3} more services
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col gap-4 pt-4 border-t">
                    <div className="flex w-full items-baseline justify-between">
                      <span className="text-3xl font-bold">{formatPrice(pkg.price)}</span>
                      <span className="text-sm text-muted-foreground">
                        Valid {pkg.validityDays} days
                      </span>
                    </div>
                    <Link href={`/package/${pkg.id}`} className="w-full">
                      <Button className="w-full" data-testid={`button-view-package-${pkg.id}`}>
                        View Details
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="package"
              title="No packages available"
              description="Check back soon for exciting healthcare packages"
            />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="Sakra Logo" className="h-8 w-8" />
              <span className="font-semibold">Sakra IKOC</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your trusted healthcare partner
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
