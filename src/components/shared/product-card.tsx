"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { BusinessProduct, WeeklyOperatingHours } from "@/lib/types";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "@/lib/motion";
import { BlurImage } from "@/components/ui/blur-image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { productImage } from "@/lib/product-images";
import { useCart } from "@/components/order/cart-provider";
import { useOptionalCartUi } from "@/components/order/cart-ui-provider";
import { useFlyToCart } from "@/components/order/fly-to-cart";
import { useBusinessAvailability } from "@/components/shared/business-availability";
import { QuantityStepper } from "@/components/order/quantity-stepper";
import { itemHref, maxOrderQuantity } from "@/lib/cart";

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

  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-layered",
        className
      )}
    >
      <Link
        href={href}
        ref={imageRef}
        tabIndex={-1}
        aria-hidden
        onClick={(e) => {
          if (!onOpen) return;
          e.preventDefault();
          onOpen(product);
        }}
        className="relative block aspect-[4/3] overflow-hidden bg-muted"
      >
        <BlurImage
          src={productImage(product.image)}
          alt=""
          fill
          sizes="(min-width: 1280px) 14rem, (min-width: 1024px) 18rem, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.popular && (
          <Badge variant="accent" className="absolute left-3 top-3">
            Popular
          </Badge>
        )}
        {soldOut ? (
          <Badge variant="danger" className="absolute right-3 top-3">
            Out of stock
          </Badge>
        ) : (
          product.stock <= product.stockLow && (
            <Badge variant="warning" className="absolute right-3 top-3">
              Only {product.stock} left
            </Badge>
          )
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug text-foreground">
          <Link
            href={href}
            onClick={(e) => {
              if (!onOpen) return;
              e.preventDefault();
              onOpen(product);
            }}
            className="rounded-sm hover:text-[var(--brand)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-foreground">{formatKES(product.price)}</span>
          <span className="font-mono text-[11px] uppercase text-muted-foreground">/ {product.unit}</span>
          {product.oldPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatKES(product.oldPrice)}</span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpen?.(product)}
            className="text-xs font-semibold text-[var(--brand)] hover:underline"
          >
            {hasOptions ? "Choose an option" : "View options"}
          </button>

          <AnimatePresence mode="wait" initial={false}>
          {soldOut ? (
            <Swap key="sold-out" reduce={reduce} className="text-xs font-medium text-muted-foreground">
              Out of stock
            </Swap>
          ) : closed ? (
            <Swap key="closed" reduce={reduce} className="text-xs font-medium text-muted-foreground">
              {closedLabel}
            </Swap>
          ) : cartItem ? (
            hasOptions ? (
              <Swap key="in-order" reduce={reduce} className="text-xs font-semibold text-[var(--brand)]">
                {cartItem.quantity} in order
              </Swap>
            ) : (
              <Swap key="stepper" reduce={reduce} inline={false}>
                <QuantityStepper
                  value={cartItem.quantity}
                  min={0}
                  max={max}
                  label={product.name}
                  size="sm"
                  onChange={(n) => updateQuantity(cartItem, n)}
                />
              </Swap>
            )
          ) : (
            <Swap key="plus" reduce={reduce} inline={false}>
              <button
                type="button"
                onClick={handleAdd}
                disabled={flying}
                aria-label={`Add ${product.name} to order`}
                className="flex size-11 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-accent transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                <Plus className="size-6" aria-hidden />
              </button>
            </Swap>
          )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
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
