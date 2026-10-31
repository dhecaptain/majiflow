import Link from "next/link";
import { Megaphone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** Promotions are not available yet; prices are set per product. */
export function BusinessPromotions() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-foreground sm:text-3xl">Promotions</h1>
      <EmptyState
        icon={<Megaphone className="size-6" aria-hidden />}
        title="Promotions are coming"
        description="Until then you can run an offer by lowering a product's price and keeping the old price shown crossed out."
        action={
          <Link href="/business/products" className={buttonVariants({ variant: "outline" })}>
            Go to products
          </Link>
        }
      />
    </div>
  );
}
