"use client";

import { useEffect, useMemo, useState } from "react";
import { Droplets } from "lucide-react";
import type { Business, BusinessProduct } from "@/lib/types";
import { ProductCard } from "@/components/shared/product-card";
import { CategoryChips, type CategoryChip } from "@/components/order/category-chips";
import { ProductSheet } from "@/components/order/product-sheet";
import { StationAvailabilityNotice } from "@/components/order/station-status";
import { EmptyState } from "@/components/ui/feedback";
import { JourneyLink } from "@/components/order/journey";
import { useOrderSession } from "@/components/order/order-session-provider";

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

  return (
    <>
      <section id="menu" aria-labelledby="menu-title" className="scroll-mt-24">
        <h2 id="menu-title" className="sr-only">
          Menu
        </h2>

        <StationAvailabilityNotice business={business} className="mb-4" />

        {business.products.length === 0 ? (
          <EmptyState
            className="mt-6"
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
            <CategoryChips categories={categories} className="mb-2" />
            <div className="flex flex-col gap-6 sm:gap-8">
              {groups.map((group) => (
                <section key={group.id} id={`cat-${group.id}`} aria-labelledby={`cat-title-${group.id}`} className="scroll-mt-24">
                  <h3 id={`cat-title-${group.id}`} className="pt-2 text-[17px] font-extrabold tracking-tight text-foreground sm:pb-3">
                    {group.label}
                  </h3>
                  <div className="flex flex-col sm:grid sm:grid-cols-2 sm:gap-3">
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
