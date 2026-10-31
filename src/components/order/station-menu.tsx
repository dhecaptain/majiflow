"use client";

import { useEffect, useMemo, useState } from "react";
import { Droplets } from "lucide-react";
import type { Business, BusinessProduct } from "@/lib/types";
import { ProductCard } from "@/components/shared/product-card";
import { CategoryChips, type CategoryChip } from "@/components/order/category-chips";
import { ProductSheet } from "@/components/order/product-sheet";
import { PromotionsStrip } from "@/components/order/promotions-strip";
import { StationAvailabilityNotice } from "@/components/order/station-status";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { JourneyLink } from "@/components/order/journey";
import { useOrderSession } from "@/components/order/order-session-provider";
import { formatKES } from "@/lib/format";

const CATEGORY_ORDER = ["refill", "bottled", "dispenser", "remineralised"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  refill: "Refills",
  bottled: "Bottled packs",
  dispenser: "Dispensers",
  remineralised: "Remineralised",
};

/**
 * The station's orderable menu: sticky category chips, grouped product grids,
 * a promotions strip and the product sheet. Client-only because it owns the
 * open-product state and cart interactions.
 */
export function StationMenu({ business }: { business: Business }) {
  const [openProduct, setOpenProduct] = useState<BusinessProduct | null>(null);
  const { setStationId } = useOrderSession();

  // Remember the station so the next visit (or another device) can continue here.
  useEffect(() => {
    setStationId(business.id);
  }, [business.id, setStationId]);

  const groups = useMemo(() => {
    const present = new Set(business.products.map((p) => p.category));
    const order = CATEGORY_ORDER.filter((c) => present.has(c));
    return order
      .map((category) => ({
        id: category,
        label: CATEGORY_LABELS[category] ?? category,
        products: business.products.filter((p) => p.category === category),
      }))
      .filter((g) => g.products.length > 0);
  }, [business.products]);

  const categories: CategoryChip[] = groups.map((g) => ({ id: g.id, label: g.label }));

  const promotions = useMemo(() => {
    const promos: { id: string; title: string; detail?: string }[] = [];
    if (business.freeDeliveryAbove > 0) {
      promos.push({
        id: "free-delivery",
        title: `Free delivery over ${formatKES(business.freeDeliveryAbove)}`,
        detail: "Automatically applied at checkout",
      });
    }
    if (business.deliveryFee > 0) {
      promos.push({
        id: "delivery-fee",
        title: `${formatKES(business.deliveryFee)} delivery`,
        detail: `~${business.avgDeliveryMinutes} min to your door`,
      });
    }
    promos.push({
      id: "sealed",
      title: "Sealed at source",
      detail: "Every bottle checked before dispatch",
    });
    return promos;
  }, [business]);

  return (
    <>
      <section id="menu" className="scroll-mt-40 border-t border-border pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-foreground sm:text-4xl">Choose your water</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap an item to pick a size or pack, or add it straight to your order.
            </p>
          </div>
          <Badge variant="mono">{business.products.length} products</Badge>
        </div>

        <StationAvailabilityNotice business={business} className="mb-4" />

        {business.products.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={<Droplets className="size-7" aria-hidden />}
            title="No items listed yet"
            description={`${business.name} hasn't published its menu. Try another station nearby.`}
            action={
              <JourneyLink step="browse" className="text-sm font-semibold text-[var(--brand)] hover:underline">
                Back to stations
              </JourneyLink>
            }
          />
        ) : (
          <>
            <PromotionsStrip promotions={promotions} className="mb-4" />
            <CategoryChips categories={categories} className="mb-6" />

            <div className="space-y-12 pb-40 lg:pb-32">
              {groups.map((group) => (
                <section key={group.id} id={`cat-${group.id}`} className="scroll-mt-40">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">{group.label}</h3>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        businessId={business.id}
                        businessSlug={business.slug}
                        openingHours={business.openingHours}
                        onOpen={setOpenProduct}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>

      <ProductSheet
        business={business}
        product={openProduct}
        open={openProduct !== null}
        onClose={() => setOpenProduct(null)}
      />
    </>
  );
}
