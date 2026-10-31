import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, Info, PackageX, Truck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { JourneyLink, JourneyRecorder } from "@/components/order/journey";
import { ItemPurchasePanel } from "@/components/order/item-purchase-panel";
import { StationAvailabilityNotice, StationCartBar } from "@/components/order/station-status";
import { getStationBySlug } from "@/lib/server/catalog";
import { itemHref, maxOrderQuantity, productRequirements } from "@/lib/cart";
import { productImage } from "@/lib/product-images";
import { formatKES } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string; productId: string }>;
}

const CATEGORY_LABEL = {
  refill: "Refill",
  bottled: "Bottled",
  dispenser: "Dispenser",
  remineralised: "Remineralised",
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productId } = await params;
  const business = await getStationBySlug(slug);
  const product = business?.products.find((p) => p.id === productId);
  if (!business || !product) return { title: "Item unavailable", robots: { index: false } };
  return { title: `${product.name} · ${business.name}`, description: product.description };
}

export default async function ItemPage({ params }: PageProps) {
  const { slug, productId } = await params;
  const business = await getStationBySlug(slug);
  if (!business) notFound();
  const product = business.products.find((p) => p.id === productId);

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        <li>
          <JourneyLink step="browse" className="inline-flex min-h-11 items-center hover:text-foreground hover:underline">
            Stations
          </JourneyLink>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5" />
        </li>
        <li>
          <Link href={`/browse/${business.slug}#menu`} className="inline-flex min-h-11 items-center hover:text-foreground hover:underline">
            {business.name}
          </Link>
        </li>
        {product && (
          <>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="truncate font-medium text-foreground">
              {product.name}
            </li>
          </>
        )}
      </ol>
    </nav>
  );

  if (!product) {
    return (
      <Container className="py-10 pb-32">
        {breadcrumb}
        <EmptyState
          className="mt-6"
          icon={<PackageX className="size-7" aria-hidden />}
          title="This item is no longer available"
          description={`${business.name} has removed it from their menu. Choose another item from the station.`}
          action={
            <Link href={`/browse/${business.slug}#menu`} className={buttonVariants({ size: "lg" })}>
              See {business.name}&apos;s menu
            </Link>
          }
        />
      </Container>
    );
  }

  const soldOut = maxOrderQuantity(product) === 0;
  const requirements = productRequirements(product, business);
  const others = business.products.filter((p) => p.id !== product.id);

  return (
    <div className="pb-40 lg:pb-32">
      <JourneyRecorder step="station" href={itemHref(business.slug, product.id)} />
      <Container className="pt-6 lg:pt-10">
        {breadcrumb}

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted shadow-layered lg:sticky lg:top-24 lg:self-start">
            <Image
              src={productImage(product.image)}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              {product.popular && <Badge variant="accent">Popular</Badge>}
              {soldOut ? (
                <Badge variant="danger">Out of stock</Badge>
              ) : (
                product.stock <= product.stockLow && <Badge variant="warning">Only {product.stock} left</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {CATEGORY_LABEL[product.category]} · {business.name}
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-foreground/80">{product.description}</p>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold tracking-tight text-foreground">{formatKES(product.price)}</span>
              <span className="text-sm text-muted-foreground">per {product.unit}</span>
              {product.oldPrice && (
                <span className="text-sm text-muted-foreground">
                  <span className="sr-only">Was </span>
                  <s>{formatKES(product.oldPrice)}</s>
                </span>
              )}
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <Truck className="size-4" aria-hidden />
                {formatKES(business.deliveryFee)} delivery
                {business.freeDeliveryAbove > 0 && <> · free over {formatKES(business.freeDeliveryAbove)}</>}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden /> ~{business.avgDeliveryMinutes} min
              </li>
            </ul>

            {requirements.length > 0 && (
              <section aria-labelledby="item-requirements" className="rounded-2xl border border-border bg-muted/40 p-4">
                <h2 id="item-requirements" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Info className="size-4 text-[var(--brand)]" aria-hidden /> Before you order
                </h2>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
                  {requirements.map((r) => (
                    <li key={r.text}>
                      {r.text}
                      {r.alternative && (
                        <>
                          {" "}
                          No empty can?{" "}
                          <Link
                            href={itemHref(business.slug, r.alternative.id)}
                            className="font-semibold text-[var(--brand)] hover:underline"
                          >
                            {r.alternative.name} ({formatKES(r.alternative.price)})
                          </Link>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <StationAvailabilityNotice business={business} />
            <ItemPurchasePanel business={business} product={product} />

            <Link
              href={`/browse/${business.slug}#menu`}
              className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-[var(--brand)] hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden /> Back to {business.name}
            </Link>
          </div>
        </div>

        {others.length > 0 && (
          <section aria-labelledby="more-items" className="mt-14 border-t border-border pt-10">
            <h2 id="more-items" className="font-display text-2xl text-foreground">
              More from {business.name}
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((p) => (
                <li key={p.id}>
                  <Link
                    href={itemHref(business.slug, p.id)}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-card transition-colors hover:border-[var(--brand)]/40"
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <Image src={productImage(p.image)} alt="" fill sizes="3rem" className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {maxOrderQuantity(p) === 0 ? "Out of stock" : `${formatKES(p.price)} / ${p.unit}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
      <StationCartBar business={business} />
    </div>
  );
}
