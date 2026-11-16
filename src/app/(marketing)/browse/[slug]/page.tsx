import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, MapPin, ShieldCheck, Smartphone, Star, Truck } from "lucide-react";
import { BusinessAvailability } from "@/components/shared/business-availability";
import { JourneyLink, JourneyRecorder } from "@/components/order/journey";
import { StationMenu } from "@/components/order/station-menu";
import { FulfilmentToggle, StationCartBar, StationOpenPill } from "@/components/order/station-status";
import { getStationBySlug } from "@/lib/server/catalog";
import { formatKES } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await getStationBySlug(slug);
  if (!business) return { title: "Station not found", robots: { index: false, follow: false } };
  return {
    title: business.name,
    description: business.tagline,
    alternates: { canonical: `/browse/${business.slug}` },
    openGraph: { title: `${business.name} · MajiFlow`, description: business.tagline, url: `/browse/${business.slug}` },
  };
}

export default async function BusinessProfile({ params }: PageProps) {
  const { slug } = await params;
  const business = await getStationBySlug(slug);
  if (!business) notFound();

  const hasRating = business.reviewCount > 0;
  const areas = business.estates.slice(0, 3).join(" · ") || business.city;

  return (
    <div className="pb-28">
      <JourneyRecorder step="station" href={`/browse/${business.slug}`} />

      {/* Cover: full-bleed on a phone, a rounded banner on a desktop. */}
      <div className="relative h-[210px] sm:h-[260px] lg:mx-auto lg:mt-6 lg:h-[300px] lg:max-w-[1200px] lg:px-6">
        <div className="relative size-full overflow-hidden bg-surface-3 lg:rounded-2xl">
          <Image src={business.cover} alt="" fill priority sizes="(min-width: 1200px) 1152px, 100vw" className="object-cover" />
        </div>
        <JourneyLink
          step="browse"
          aria-label="Back to stations"
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+0.875rem)] flex size-11 items-center justify-center rounded-full bg-white text-foreground shadow-card transition-colors hover:bg-surface-2 lg:left-10 lg:top-4"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </JourneyLink>
      </div>

      <div className="relative -mt-6 rounded-t-2xl bg-white lg:mt-0 lg:rounded-none">
        <div className="mx-auto max-w-[1200px] px-4 pt-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:pt-8">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <StationOpenPill business={business} />
                {business.verified && (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-aqua-soft px-2.5 text-xs font-bold text-[#00707d]">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Verified
                  </span>
                )}
              </div>
              <h1 className="font-display text-[26px] font-bold leading-tight text-foreground lg:text-4xl">{business.name}</h1>
              <p className="text-sm text-muted-foreground lg:text-base">{business.tagline || areas}</p>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
              <div className="flex flex-col items-center gap-0.5 px-2 py-3">
                <dt className="sr-only">Rating</dt>
                <dd className="flex items-center gap-1 text-[15px] font-extrabold text-foreground">
                  {hasRating ? (
                    <>
                      <Star className="size-4 fill-sun text-sun" aria-hidden />
                      {business.rating.toFixed(1)}
                    </>
                  ) : (
                    "New"
                  )}
                </dd>
                <dd className="text-xs text-muted-foreground">{hasRating ? `${business.reviewCount} reviews` : "No reviews yet"}</dd>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-2 py-3">
                <dt className="sr-only">Delivery time</dt>
                <dd className="text-[15px] font-extrabold text-foreground">~{business.avgDeliveryMinutes} min</dd>
                <dd className="text-xs text-muted-foreground">Delivery</dd>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-2 py-3">
                <dt className="sr-only">Delivery fee</dt>
                <dd className="text-[15px] font-extrabold text-foreground">
                  {business.deliveryFee === 0 ? "Free" : formatKES(business.deliveryFee)}
                </dd>
                <dd className="text-xs text-muted-foreground">Delivery fee</dd>
              </div>
            </dl>

            <FulfilmentToggle business={business} />

            {business.freeDeliveryAbove > 0 && business.deliveryFee > 0 && (
              <p className="rounded-md bg-success-soft px-3 py-2.5 text-[13px] font-semibold text-[#14532d]">
                Free delivery on orders over {formatKES(business.freeDeliveryAbove)}
              </p>
            )}

            <StationMenu business={business} />
          </div>

          {/* About the station: beside the menu on a desktop, after it on a phone. */}
          <aside aria-labelledby="about-title" className="mt-10 flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:mt-0 lg:self-start">
            <h2 id="about-title" className="text-[17px] font-extrabold tracking-tight text-foreground">
              About this station
            </h2>
            {business.description && (
              <p className="text-sm leading-relaxed text-foreground/85">{business.description}</p>
            )}
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              <div className="flex gap-3 p-4">
                <Clock className="mt-0.5 size-[18px] shrink-0 text-[var(--brand)]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Opening hours</p>
                  <BusinessAvailability hours={business.openingHours} compact className="!mt-1" />
                </div>
              </div>
              <div className="flex gap-3 p-4">
                <Truck className="mt-0.5 size-[18px] shrink-0 text-[var(--brand)]" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-foreground">Delivery</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {business.deliveryFee === 0 ? "Free delivery" : `${formatKES(business.deliveryFee)} per order`}
                    {business.freeDeliveryAbove > 0 && business.deliveryFee > 0 && (
                      <> · free over {formatKES(business.freeDeliveryAbove)}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-4">
                <Smartphone className="mt-0.5 size-[18px] shrink-0 text-[var(--brand)]" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-foreground">Payment</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {business.acceptsMpesa ? "Pay on delivery or M-Pesa" : "Pay on delivery"}
                  </p>
                </div>
              </div>
              {business.estates.length > 0 && (
                <div className="flex gap-3 p-4">
                  <MapPin className="mt-0.5 size-[18px] shrink-0 text-[var(--brand)]" aria-hidden />
                  <div>
                    <p className="text-sm font-bold text-foreground">Delivers to</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{business.estates.join(", ")}</p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <StationCartBar />
    </div>
  );
}
