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
import { itemHref, maxOrderQuantity, productRequirements, listPrice } from "@/lib/cart";
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
  return {
    title: `${product.name} · ${business.name}`,
    description: product.description,
    alternates: { canonical: `/browse/${business.slug}/${product.id}` },
  };
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
      <Container className="pt-3 lg:pt-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/browse/${business.slug}#menu`}
            className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full pr-3 text-sm font-bold text-foreground transition-colors hover:text-[var(--brand)]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white shadow-soft">
              <ArrowLeft className="size-5" aria-hidden />
            </span>
            <span className="truncate">
              <span className="sr-only">Back to </span>
              {business.name}
            </span>
          </Link>
          <div className="ml-auto hidden lg:block">{breadcrumb}</div>
        </div>

        <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-2 lg:gap-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-soft lg:sticky lg:top-24 lg:self-start">
            <Image
              src={productImage(product.image)}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className={soldOut ? "object-cover grayscale" : "object-cover"}
            />
            <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-2">
              {product.popular && <Badge variant="accent">Popular</Badge>}
              {soldOut ? (
                <Badge variant="danger">Out of stock</Badge>
              ) : (
                product.stock <= product.stockLow && <Badge variant="warning">Only {product.stock} left</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-muted-foreground">
                {CATEGORY_LABEL[product.category]} · {business.name}
              </p>
              <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
                {product.name}
              </h1>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{product.description}</p>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {listPrice(product).from && <span className="text-sm font-medium text-muted-foreground">From</span>}
              <span className="text-2xl font-extrabold tracking-tight text-foreground">{formatKES(listPrice(product).amount)}</span>
              <span className="text-sm text-muted-foreground">per {product.unit}</span>
              {product.oldPrice && (
                <span className="text-sm text-muted-foreground">
                  <span className="sr-only">Was </span>
                  <s>{formatKES(product.oldPrice)}</s>
                </span>
              )}
            </div>

            <ul className="flex flex-wrap gap-2 text-[13px] font-semibold text-foreground">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5">
                <Truck className="size-4 text-[var(--brand)]" aria-hidden />
                {formatKES(business.deliveryFee)} delivery
                {business.freeDeliveryAbove > 0 && <> · free over {formatKES(business.freeDeliveryAbove)}</>}
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5">
                <Clock className="size-4 text-[var(--brand)]" aria-hidden /> ~{business.avgDeliveryMinutes} min
              </li>
            </ul>

            {requirements.length > 0 && (
              <section aria-labelledby="item-requirements" className="rounded-md bg-surface-2 p-4">
                <h2 id="item-requirements" className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Info className="size-4 text-[var(--brand)]" aria-hidden /> Before you order
                </h2>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-foreground/85">
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
          </div>
        </div>

        {others.length > 0 && (
          <section aria-labelledby="more-items" className="mt-10 border-t border-[#eef3fa] pt-6 lg:mt-14 lg:pt-10">
            <h2 id="more-items" className="text-lg font-extrabold tracking-tight text-foreground">
              More from {business.name}
            </h2>
            <ul className="mt-2 grid lg:grid-cols-2 lg:gap-x-8">
              {others.map((p) => (
                <li key={p.id} className="border-b border-[#eef3fa] last:border-b-0">
                  <Link
                    href={itemHref(business.slug, p.id)}
                    className="group flex min-h-16 items-center gap-3 py-3"
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-brand-soft">
                      <Image src={productImage(p.image)} alt="" fill sizes="3.5rem" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-foreground group-hover:text-[var(--brand)]">{p.name}</span>
                      <span className="block text-[13px] text-muted-foreground">
                        {maxOrderQuantity(p) === 0 ? "Out of stock" : `${listPrice(p).from ? "From " : ""}${formatKES(listPrice(p).amount)} / ${p.unit}`}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
      <StationCartBar />
    </div>
  );
}
