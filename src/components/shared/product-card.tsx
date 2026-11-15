"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { BusinessProduct, WeeklyOperatingHours } from "@/lib/types";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "@/lib/motion";
import { BlurImage } from "@/components/ui/blur-image";
import { useToast } from "@/components/ui/toast";
import { productImage } from "@/lib/product-images";
import { useCart } from "@/components/order/cart-provider";
import { useOptionalCartUi } from "@/components/order/cart-ui-provider";
import { useFlyToCart } from "@/components/order/fly-to-cart";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { itemHref, maxOrderQuantity, listPrice } from "@/lib/cart";

interface ProductCardProps {
  product: BusinessProduct;
  businessId: string;
  businessSlug: string;
  openingHours: WeeklyOperatingHours | undefined;
  className?: string;
  /** Open the product sheet (options, quantity). Falls back to the item link. */
  onOpen?: (product: BusinessProduct) => void;
}

export function ProductCard({ product, businessId, businessSlug, openingHours, className, onOpen }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartUi = useOptionalCartUi();
  const { toast } = useToast();
  const { reduce } = useMotionSafe();
  const availability = useBusinessAvailability(openingHours);
  const fly = useFlyToCart();
  const [flying, setFlying] = useState(false);
  const imageRef = useRef<HTMLAnchorElement | null>(null);
  // The fly-to-cart animation lands after ~1s; the card may be gone by then.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const cartItem = items.find(
    (i) => i.businessId === businessId && i.productId === product.id
  );

  const href = itemHref(businessSlug, product.id);
  const max = maxOrderQuantity(product);
  const soldOut = max === 0;
  // A product with choices is always opened in the sheet: the customer picks
  // the option there, so a quick tap can never add the wrong one.
  const hasOptions = (product.options?.length ?? 0) > 0;
  const closed = availability.state !== "open";
  const closedLabel =
    availability.state === "closed" ? "Station closed" : "Hours unavailable";

  const handleAdd = () => {
    if (closed || soldOut) return;
    if (hasOptions) {
      onOpen?.(product);
      return;
    }
    const add = () => {
      const line = { businessId, productId: product.id, quantity: 1 };
      if (cartUi) cartUi.requestAdd(line);
      else addItem(line);
      toast({ kind: "success", title: "Added to order", message: `1 × ${product.name}` });
    };
    const fromEl = imageRef.current;
    if (!fromEl) {
      add();
      return;
    }
    setFlying(true);
    fly({
      fromEl,
      src: productImage(product.image).src,
      alt: product.name,
      onDone: () => {
        add();
        if (mountedRef.current) setFlying(false);
      },
    });
  };

  const open = (e: MouseEvent) => {
    if (!onOpen) return;
    e.preventDefault();
    onOpen(product);
  };
  const price = listPrice(product);

  return (
    <article
      className={cn(
        "group relative flex gap-4 border-b border-[#eef3fa] py-4 transition-colors last:border-b-0 sm:rounded-lg sm:border sm:border-border sm:p-4 sm:last:border-b sm:hover:border-[var(--brand)]/40",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {(product.popular || soldOut || product.stock <= product.stockLow) && (
          <span className="flex flex-wrap gap-1.5">
            {product.popular && (
              <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-bold text-coral-cta-hover">Popular</span>
            )}
            {soldOut ? (
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">Out of stock</span>
            ) : (
              product.stock <= product.stockLow && (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">
                  Only {product.stock} left
                </span>
              )
            )}
          </span>
        )}
        <h3 className="text-[15px] font-bold leading-snug text-foreground">
          {/* The whole row opens the item; the add control sits above this link. */}
          <Link
            href={href}
            onClick={open}
            className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--brand)]"
          >
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{product.description}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-extrabold text-foreground">
          <span>
            {price.from && "From "}
            {formatKES(price.amount)}
          </span>
          <span className="text-xs font-medium text-muted-foreground">/ {product.unit}</span>
          {product.oldPrice && (
            <span className="text-xs font-medium text-muted-foreground line-through">{formatKES(product.oldPrice)}</span>
          )}
        </p>
        {(closed || (cartItem && hasOptions)) && !soldOut && (
          <p className={cn("text-xs font-semibold", closed ? "text-muted-foreground" : "text-[var(--brand)]")}>
            {closed ? closedLabel : `${cartItem!.quantity} in your order`}
          </p>
        )}
      </div>

      <div className="relative size-[104px] shrink-0">
        <Link
          href={href}
          ref={imageRef}
          tabIndex={-1}
          aria-hidden
          onClick={open}
          className="relative block size-full overflow-hidden rounded-lg bg-surface-2"
        >
          <BlurImage
            src={productImage(product.image)}
            alt=""
            fill
            sizes="104px"
            className={cn("object-cover transition-transform duration-500 group-hover:scale-105", soldOut && "grayscale")}
          />
        </Link>

        <div className="absolute -bottom-2 -right-2 z-10">
          <AnimatePresence mode="wait" initial={false}>
            {soldOut || closed ? null : cartItem && !hasOptions ? (
              <Swap key="stepper" reduce={reduce} inline={false}>
                <QuantityStepper
                  value={cartItem.quantity}
                  min={0}
                  max={max}
                  label={product.name}
                  size="sm"
                  className="shadow-card"
                  onChange={(n) => updateQuantity(cartItem, n)}
                />
              </Swap>
            ) : (
              <Swap key="plus" reduce={reduce} inline={false}>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={flying}
                  aria-label={hasOptions ? `Choose an option for ${product.name}` : `Add ${product.name} to order`}
                  className="flex size-11 items-center justify-center rounded-full border-[3px] border-white bg-[var(--brand)] text-white shadow-accent transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  <Plus className="size-5" aria-hidden />
                </button>
              </Swap>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

/** One state of the add/stepper slot; AnimatePresence cross-fades between states. */
function Swap({
  reduce,
  inline = true,
  className,
  children,
}: {
  reduce: boolean;
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const hidden = reduce ? undefined : { opacity: 0, scale: 0.85 };
  const props = {
    initial: reduce ? false : hidden,
    animate: { opacity: 1, scale: 1 },
    exit: hidden ?? { opacity: 0 },
    transition: reduce ? { duration: 0 } : { duration: 0.18 },
    className: cn("inline-flex items-center", className),
  };
  return inline ? <motion.span {...props}>{children}</motion.span> : <motion.div {...props}>{children}</motion.div>;
}
