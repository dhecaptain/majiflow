import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, ShieldCheck, Smartphone, Star, Truck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { StationBadge } from "@/components/shared/station-badge";
import { BusinessAvailability } from "@/components/shared/business-availability";
import { JourneyLink, JourneyRecorder } from "@/components/order/journey";
import { StationMenu } from "@/components/order/station-menu";
import { getBusiness, businesses } from "@/lib/data/businesses";
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
    <div>
      <JourneyRecorder step="station" href={`/browse/${business.slug}`} />
      {/* Banner */}
      <section className="relative overflow-hidden bg-ink">
        <div aria-hidden className="absolute inset-0">
          <Image
            src={business.cover}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/20" />
        </div>

        <Container className="relative pb-8 pt-40 sm:pt-56">
          <JourneyLink
            step="browse"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to stations
          </JourneyLink>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-tight tracking-tight text-white sm:text-4xl">
              {business.name}
            </h1>
            <StationBadge verified={business.verified} paid={business.paid} />
          </div>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/85">{business.tagline}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <Star className="size-4 fill-warning text-warning" aria-hidden />
              {business.rating}
              <span className="font-normal text-white/70">({business.reviewCount})</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {business.city}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-4" aria-hidden /> {formatKES(business.deliveryFee)} delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden /> ~{business.avgDeliveryMinutes} min
            </span>
          </div>
        </Container>
      </section>

      {/* About + details */}
      <section className="py-12 lg:py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-display text-2xl text-foreground">About this station</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">
                {business.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {business.estates.map((e) => (
                  <span
                    key={e}
                    className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
                  >
                    Delivers to {e}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="size-4 text-[var(--brand)]" aria-hidden /> Opening hours
                </div>
                <BusinessAvailability hours={business.openingHours} compact className="mt-2" />
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Truck className="size-4 text-[var(--brand)]" aria-hidden /> Delivery
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatKES(business.deliveryFee)} per order
                  {business.freeDeliveryAbove > 0 && (
                    <> · free over {formatKES(business.freeDeliveryAbove)}</>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Smartphone className="size-4 text-[var(--brand)]" aria-hidden /> Payment
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {business.acceptsMpesa ? "M-Pesa" : "Pay on delivery"}
                  {business.acceptsCard && " · Card"}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-[var(--brand)]" aria-hidden /> Stock
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {lowStockCount > 0 ? `${lowStockCount} items low` : "Plenty in stock"} · sealed before dispatch
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Menu */}
      <section className="py-4 lg:py-6">
        <Container>
          <StationMenu business={business} />
        </Container>
      </section>
    </div>
  );
}
