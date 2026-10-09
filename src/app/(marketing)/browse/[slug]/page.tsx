import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Star,
  Truck,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/shared/product-card";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { getBusiness } from "@/lib/data/businesses";
import { businesses } from "@/lib/data/businesses";
import { formatKES } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return businesses.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = getBusiness(slug);
  if (!business) return { title: "Not found" };
  return {
    title: business.name,
    description: business.tagline,
  };
}

export default async function BusinessProfile({ params }: PageProps) {
  const { slug } = await params;
  const business = getBusiness(slug);
  if (!business) notFound();

  const lowStockCount = business.products.filter((p) => p.stock <= p.stockLow).length;

  return (
    <div className="pb-24">
      {/* Business header */}
      <section className="relative overflow-hidden border-b border-border bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: `radial-gradient(ellipse 70% 60% at 85% 10%, ${business.accent}14, transparent 60%)` }}
        />
        <Container className="relative py-10 lg:py-14">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[#0052FF]"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to browse
          </Link>

          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
                  {business.name}
                </h1>
                <VerifiedBadge verified={business.verified} paid={business.paid} />
                <Badge variant="mono">{business.subscription} plan</Badge>
              </div>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{business.tagline}</p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-foreground/80">
                {business.description}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <Star className="size-4 fill-warning text-warning" aria-hidden />
                  {business.rating}
                  <span className="font-normal text-muted-foreground">({business.reviewCount} reviews)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-[#0052FF]" aria-hidden /> {business.city}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="size-4 text-[#0052FF]" aria-hidden /> {formatKES(business.deliveryFee)} delivery
                  {business.freeDeliveryAbove > 0 && (
                    <span className="text-success">· free over {formatKES(business.freeDeliveryAbove)}</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 text-[#0052FF]" aria-hidden /> ~{business.avgDeliveryMinutes} min average
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {business.estates.map((e) => (
                  <span
                    key={e}
                    className="rounded-md border border-border bg-muted/60 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Delivers to {e}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-success-soft text-success">
                  <Smartphone className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {business.acceptsMpesa ? "M-Pesa STK ready" : "Pay on delivery"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {business.acceptsCard && "Card also accepted"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#0052FF]/10 text-[#0052FF]">
                  <ShieldCheck className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {lowStockCount > 0 ? `${lowStockCount} low-stock items` : "Plenty in stock"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Sealed before dispatch</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Menu */}
      <section id="menu" className="scroll-mt-20 py-14 lg:py-16">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel pulse>Order from this station</SectionLabel>
              <h2 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
                Add to your cart
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Prices are set by the business in KES. Delivery is added at checkout. Free delivery
              on orders over {formatKES(business.freeDeliveryAbove)}.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {business.products.map((product) => (
              <ProductCard key={product.id} product={product} businessId={business.id} />
            ))}
          </div>
        </Container>
      </section>

      {/* Rating strip */}
      <section className="border-t border-border bg-muted/40 py-12">
        <Container>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { k: "Delivery reliability", v: 4.9 },
              { k: "Water quality", v: 4.8 },
              { k: "Value for money", v: 4.7 },
            ].map((r) => (
              <div key={r.k} className="rounded-xl border border-border bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{r.k}</p>
                  <p className="text-sm font-bold text-foreground">{r.v}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div
                    className="h-full rounded-full bg-brand-gradient"
                    style={{ width: `${(r.v / 5) * 100}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {business.reviewCount} neighbours rated
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <em>
              "Litre for litre, the cleanest water in {business.city} — the rider even calls before
              the gate opens." — verified customer review
            </em>
          </p>
        </Container>
      </section>
    </div>
  );
}