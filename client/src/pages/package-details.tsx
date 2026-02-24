import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Check, Clock, Calendar, ChevronRight, Users, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingPage } from "@/components/loading-spinner";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPackagePricingTiers, getLowestPrice, type Package } from "@shared/schema";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function PackageDetailsPage() {
  const [, params] = useRoute("/package/:id");
  const [, navigate] = useLocation();
  const packageId = params?.id;

  const { data: pkg, isLoading, error } = useQuery<Package>({
    queryKey: ["/api/packages", packageId],
    enabled: !!packageId,
  });

  if (isLoading) {
    return <LoadingPage />;
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Package not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The package you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button data-testid="button-back-home">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tiers = getPackagePricingTiers(pkg);
  const lowestPrice = getLowestPrice(pkg);

  return (
    <div className="min-h-screen bg-background" data-testid="page-package-details">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold">Package Details</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-32">
        <Card className="overflow-hidden" data-testid="card-package-details">
          <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 pb-6">
            {pkg.badge && (
              <div className={`-mx-6 -mt-6 mb-4 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-white ${
                pkg.badge === "most_popular" ? "bg-amber-500" : "bg-emerald-500"
              }`} data-testid={`badge-${pkg.badge}`}>
                {pkg.badge === "most_popular" ? (
                  <><Star className="h-4 w-4" /> Most Popular</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Best Value</>
                )}
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl mb-2">{pkg.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {pkg.validityMonths} months validity
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    {pkg.services.length} services
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                {tiers.length > 1 ? (
                  <>
                    <p className="text-xs text-muted-foreground">Starts at</p>
                    <p className="text-3xl font-bold text-primary">{formatPrice(lowestPrice)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-primary">{formatPrice(lowestPrice)}</p>
                    <p className="text-sm text-muted-foreground">
                      {tiers[0].adultsCount} Adults, {tiers[0].kidsCount} Kids
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-6">{pkg.description}</p>

            {/* Pricing Tiers */}
            {tiers.length > 0 && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {tiers.length > 1 ? "Available Options" : "Coverage"}
                  </h3>
                  <div className="space-y-3">
                    {tiers.map((tier, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-md border bg-muted/30"
                        data-testid={`tier-option-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" />
                            {tier.adultsCount} Adults, {tier.kidsCount} Kids
                          </Badge>
                        </div>
                        <span className="text-xl font-bold">{formatPrice(tier.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator className="my-6" />

            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Included Services
              </h3>
              <div className="space-y-4">
                {pkg.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`service-item-${service.id}`}
                  >
                    <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{service.name}</p>
                        {service.type === "percentage" && service.percentage ? (
                          <Badge variant="secondary" className="text-xs">
                            {service.percentage}% off
                          </Badge>
                        ) : service.isUnlimited ? (
                          <Badge variant="secondary" className="text-xs">
                            Unlimited
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {service.quantity === 1 ? "1" : `${service.quantity} sessions`}
                          </Badge>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {pkg.termsAndConditions && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="font-semibold mb-3">Terms & Conditions</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {pkg.termsAndConditions}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 z-50">
        <div className="mx-auto max-w-2xl">
          <Button
            size="lg"
            className="w-full h-12"
            onClick={() => navigate(`/buy/${pkg.id}`)}
            data-testid="button-buy-now"
          >
            Buy Now {tiers.length > 1 ? `- Starting at ${formatPrice(lowestPrice)}` : `- ${formatPrice(lowestPrice)}`}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
