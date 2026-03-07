import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Phone,
  LogIn,
  Star,
  Sparkles,
  ChevronRight,
  Stethoscope,
  Heart,
  Microscope,
  Ambulance,
  Activity,
  ClipboardList,
  UserPlus,
  ShieldCheck,
  TrendingUp,
  Building2,
  Award,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  ChevronDown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LoadingSpinner } from "@/components/loading-spinner";

import { useCustomerAuth } from "@/lib/auth";
import { getLowestPrice, type Package } from "@shared/schema";
import sakraIkocLogo from "@assets/Sakra_IKOC_Logo_(3)_1772012091670.png";
import { HospitalCarousel } from "@/components/hospital-carousel";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { customer, token } = useCustomerAuth();

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages/active"],
  });

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-landing">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2">
            </div>
            <div className="absolute left-1/2 -translate-x-1/2">
              <img src={sakraIkocLogo} alt="Sakra World Hospital in association with IKOC" className="h-12 object-contain" />
            </div>
            <div className="flex items-center gap-2">
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

      {/* SECTION 1 - HERO */}
      <section className="relative py-20 sm:py-28" data-testid="section-hero">
        <div className="absolute inset-0">
          <img
            src="/images/hero-hospital.jpg"
            alt="Sakra World Hospital"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/60 to-black/50" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl drop-shadow-md">
              Protect Your Family's Health for an Entire Year
            </h1>
            <p className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-amber-400 drop-shadow-md">
              Starting at {formatPrice(100)}
            </p>
            <div className="mt-6 space-y-2 text-lg text-white/90">
              <p>Unlimited General Physician Consultation</p>
              <p>Super Speciality Consultation</p>
              <p>Diagnostics Discount Up to 40% Off</p>
              <p className="font-semibold">Much More</p>
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => scrollToSection("pricing")}
                className="text-lg px-10 py-7 font-bold shadow-lg"
                data-testid="button-hero-cta"
              >
                Get CarePlus Now
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              {!customer ? (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/login")}
                  className="border-white/40 text-white backdrop-blur-sm"
                  data-testid="button-hero-login"
                >
                  Already a member? Login
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="border-white/40 text-white backdrop-blur-sm"
                  data-testid="button-hero-dashboard"
                >
                  Go to My Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y bg-muted/30 py-4" data-testid="section-trust-strip">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm font-medium text-muted-foreground">
            <div className="flex items-center gap-2" data-testid="trust-validity">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>1-Year Validity</span>
            </div>
            <div className="flex items-center gap-2" data-testid="trust-emergency">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Emergency Support</span>
            </div>
            <div className="flex items-center gap-2" data-testid="trust-sakra">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Trusted by SAKRA IKOC</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 - PROBLEM STATEMENT */}
      <section className="py-16 sm:py-20" data-testid="section-problem">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
            <div className="flex flex-col items-center lg:items-start">
              <div className="w-full max-w-sm rounded-md bg-muted/50 p-8 flex flex-col items-center text-center">
                <Heart className="h-16 w-16 text-primary/60 mb-4" />
                <p className="text-lg font-semibold">Your Family Deserves Better Healthcare</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Rising costs shouldn't stop you from getting the care you need.
                </p>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mb-6">
                Healthcare Costs Are Rising.
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">OPD is not covered by insurance — every visit comes from your pocket</p>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">Diagnostic bills keep increasing year after year</p>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">Families delay preventive care due to high costs</p>
                </div>
              </div>
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={() => scrollToSection("pricing")}
                  data-testid="button-problem-cta"
                >
                  Secure Your Family Today
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 - WHAT IS CAREPLUS */}
      <section className="py-16 sm:py-20 bg-muted/20" data-testid="section-what-is">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mb-4">
            What is CarePlus?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
            CarePlus is a comprehensive healthcare membership that gives your family access to essential medical services at a fraction of the cost.
          </p>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { icon: Stethoscope, label: "Unlimited General Physician", desc: "Consult anytime" },
              { icon: Activity, label: "Specialist Consults", desc: "Expert doctors" },
              { icon: Microscope, label: "Diagnostics Discount", desc: "Up to 40% off" },
              { icon: Ambulance, label: "Ambulance Pickup", desc: "Emergency ready" },
              { icon: Heart, label: "Rehab Support", desc: "Recovery care" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-3 p-4" data-testid={`feature-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="rounded-full bg-primary/10 p-4">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 - HOW IT WORKS */}
      <section className="py-16 sm:py-20" data-testid="section-how-it-works">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
            {[
              { step: "1", icon: ClipboardList, title: "Choose Plan", desc: "Pick the plan that fits your family's needs" },
              { step: "2", icon: UserPlus, title: "Register Online", desc: "Quick registration with mobile number" },
              { step: "3", icon: Users, title: "Add Family Members", desc: "Include your loved ones in the plan" },
              { step: "4", icon: ShieldCheck, title: "Access Health Care", desc: "Start using services at Sakra IKOC Hospital" },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center gap-4 p-6" data-testid={`step-${item.step}`}>
                <div className="relative">
                  <div className="rounded-full bg-primary/10 p-5">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 - PRICING TABLE (Dynamic from DB) */}
      <section id="pricing" className="py-16 sm:py-20 bg-muted/20" data-testid="section-pricing">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Choose Your Plan
            </h2>
            <p className="mt-4 text-muted-foreground">
              Find the perfect CarePlus package for your family
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : packages && packages.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((pkg) => {
                const isMostPopular = pkg.badge === "most_popular";
                const isBestValue = pkg.badge === "best_value";
                return (
                  <Card
                    key={pkg.id}
                    className={`flex flex-col hover-elevate relative ${
                      isMostPopular ? "ring-2 ring-amber-400 dark:ring-amber-500" : isBestValue ? "ring-2 ring-emerald-400 dark:ring-emerald-500" : ""
                    }`}
                    data-testid={`card-package-${pkg.id}`}
                  >
                    {pkg.badge && (
                      <div
                        className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-white rounded-t-md ${
                          isMostPopular ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        data-testid={`badge-${pkg.badge}-${pkg.id}`}
                      >
                        {isMostPopular ? (
                          <>
                            <Star className="h-3.5 w-3.5" /> Most Popular
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" /> Best Value
                          </>
                        )}
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{pkg.title}</CardTitle>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {pkg.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="mb-4">
                        <span className="text-xs text-muted-foreground">Starting at</span>
                        <div className="text-3xl font-bold">{formatPrice(getLowestPrice(pkg))}</div>
                      </div>
                      <div className="space-y-2">
                        {pkg.services.slice(0, 4).map((service) => (
                          <div key={service.id} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{service.name}</span>
                          </div>
                        ))}
                        {pkg.services.length > 4 && (
                          <p className="text-xs text-muted-foreground pl-5">
                            +{pkg.services.length - 4} more services
                          </p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-3 pt-4 border-t">
                      <div className="text-xs text-muted-foreground w-full">
                        Valid {pkg.validityMonths} months
                      </div>
                      <Link href={`/package/${pkg.id}`} className="w-full">
                        <Button className="w-full" data-testid={`button-enroll-${pkg.id}`}>
                          Enroll Now
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Packages coming soon. Check back later!
            </div>
          )}
        </div>
      </section>

      {/* SECTION 6 - SAVINGS COMPARISON */}
      <section className="py-16 sm:py-20" data-testid="section-savings">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-center mb-12">
            See How Much You Save
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
            <Card className="border-destructive/20" data-testid="card-hospital-cost">
              <CardHeader>
                <CardTitle className="text-lg text-destructive dark:text-red-400">Hospital Visit Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>GP Consultation</span>
                  <span className="font-medium">{formatPrice(800)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Specialist Visit</span>
                  <span className="font-medium">{formatPrice(1500)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Basic Lab Tests</span>
                  <span className="font-medium">{formatPrice(1200)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Follow-up Visit</span>
                  <span className="font-medium">{formatPrice(500)}</span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>One Visit</span>
                    <span className="text-destructive dark:text-red-400">{formatPrice(4000)}+</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30" data-testid="card-careplus-cost">
              <CardHeader>
                <CardTitle className="text-lg text-primary">CarePlus Membership Cost</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Unlimited GP Consultations</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Specialist Access</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Diagnostics Discounts</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Emergency Ambulance</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>One Year Protection</span>
                    <span className="text-emerald-500 font-extrabold">{formatPrice(500)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6 max-w-2xl mx-auto italic">
            The above values represent the approximate market value for one patient.
          </p>
          <div className="text-center mt-10">
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              data-testid="button-savings-register"
            >
              Register Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 7 - ABOUT SAKRA IKOC */}
      <section className="py-16 sm:py-20 bg-muted/20" data-testid="section-about">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mb-6">
              About Sakra IKOC
            </h2>
            <p className="text-muted-foreground max-w-4xl mx-auto text-base sm:text-lg leading-relaxed">
              Sakra World Hospital, known for its excellence in healthcare, has joined hands with IKOC – an advanced centre offering comprehensive care across multiple specialties. Our expertise covers a wide range of medical disciplines, allowing us to deliver complete, patient-focused care. From complex surgeries to thorough internal medicine services, we ensure seamless teamwork to support every stage of a patient's health journey. This collaboration brings together Sakra's world-class infrastructure and IKOC's clinical expertise to deliver exceptional outcomes across these specialties. With a strong emphasis on innovation, compassion, and precision, Sakra Hospital offers a complete spectrum of services — from prevention, screening, and education to advanced clinical treatments and rehabilitation. Together, Sakra and IKOC are enhancing the standards of care across all key specialties through cutting-edge technology and a highly experienced team of medical professionals.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 8 - TESTIMONIALS */}
      <section className="py-16 sm:py-20" data-testid="section-testimonials">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-center mb-12">
            What Our Members Say
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {[
              {
                quote: "Best decision I made for my parents. They visit the hospital regularly without worrying about costs.",
                name: "Priya S.",
                role: "Daughter of CarePlus member",
              },
              {
                quote: "The unlimited GP consultations alone made it worth it. My family of four saved over 15,000 in the first six months.",
                name: "Rajesh K.",
                role: "CarePlus Gold member",
              },
              {
                quote: "The ambulance service gave us peace of mind. When my father needed emergency care, everything was taken care of.",
                name: "Anita M.",
                role: "CarePlus member since 2024",
              },
            ].map((testimonial) => (
              <Card key={testimonial.name} className="flex flex-col" data-testid={`testimonial-${testimonial.name.toLowerCase().replace(/\s/g, "-")}`}>
                <CardContent className="flex-1 pt-6">
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                </CardContent>
                <CardFooter className="pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9 - FAQ */}
      <section className="py-16 sm:py-20 bg-muted/20" data-testid="section-faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-center mb-12">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="included" data-testid="faq-included">
              <AccordionTrigger>What is included in CarePlus?</AccordionTrigger>
              <AccordionContent>
                CarePlus includes unlimited GP consultations, specialist access, diagnostic discounts up to 40%, ambulance pickup service, and rehabilitation support. The exact services depend on the plan you choose.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="family" data-testid="faq-family">
              <AccordionTrigger>Is it valid for my family?</AccordionTrigger>
              <AccordionContent>
                Yes! CarePlus offers family plans that cover adults and children. You can choose a plan that fits your family size — from individual coverage to plans covering up to 4 adults and 4 kids.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="booking" data-testid="faq-booking">
              <AccordionTrigger>How to book an appointment?</AccordionTrigger>
              <AccordionContent>
                Once enrolled in the CarePlus Program, you can book your appointment directly at Sakra IKOC Hospital. Simply provide your registered mobile number at the reception, and our team will verify your membership digitally. Your CarePlus benefits will be applied automatically.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ambulance" data-testid="faq-ambulance">
              <AccordionTrigger>Is ambulance service included?</AccordionTrigger>
              <AccordionContent>
                Yes, ambulance pickup service is included in select CarePlus plans. In case of an emergency, call the hospital helpline and an ambulance will be dispatched to your location.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-16 sm:py-20 bg-secondary text-secondary-foreground" data-testid="section-final-cta">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mb-4">
            Don't Wait for the Next Hospital Bill.
          </h2>
          <p className="text-secondary-foreground/70 text-lg mb-8">
            Secure Your Family Today.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              variant="default"
              onClick={() => scrollToSection("pricing")}
              className="bg-primary text-primary-foreground"
              data-testid="button-final-cta"
            >
              Get CarePlus Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a href="https://wa.me/918049694969" target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp">
              <Button size="lg" variant="outline" className="w-full border-secondary-foreground/30 text-secondary-foreground" data-testid="button-whatsapp">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp Us
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* HOSPITAL AT A GLANCE - CAROUSEL */}
      <HospitalCarousel />

      {/* FOOTER */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="Sakra Logo" className="h-8 w-8" />
              <span className="font-semibold">Sakra World Hospital</span>
            </div>
            <p className="text-sm text-muted-foreground">
              CarePlus — Your trusted healthcare partner
            </p>
          </div>
        </div>
      </footer>

      {/* STICKY BOTTOM BAR (Mobile Only) */}
      <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur p-3 sm:hidden" data-testid="sticky-bottom-bar">
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={() => scrollToSection("pricing")}
            data-testid="button-mobile-enroll"
          >
            Enroll Now
          </Button>
          <a href="tel:+918049694969" className="flex-1" data-testid="link-mobile-call">
            <Button variant="outline" className="w-full" data-testid="button-mobile-call">
              <Phone className="mr-2 h-4 w-4" />
              Call Now
            </Button>
          </a>
        </div>
      </div>

      {/* Bottom padding for mobile sticky bar */}
      <div className="h-16 sm:hidden" />
    </div>
  );
}
