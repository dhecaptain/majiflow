"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import type { BusinessProduct, WeeklyOperatingHours } from "@/lib/types";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { productImage } from "@/lib/product-images";
import { useCart } from "@/components/order/cart-provider";
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
}

export function ProductCard({ product, businessId, businessSlug, openingHours, className }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const { toast } = useToast();
  const availability = useBusinessAvailability(openingHours);
  const fly = useFlyToCart();
  const [qty, setQty] = useState(1);
  const [flying, setFlying] = useState(false);
  const imageRef = useRef<HTMLAnchorElement | null>(null);
  const cartItem = items.find(
    (i) => i.businessId === businessId && i.productId === product.id
  );

  const href = itemHref(businessSlug, product.id);
  const max = maxOrderQuantity(product);
  const soldOut = max === 0;
  const closed = availability.state !== "open";
  const closedLabel =
    availability.state === "closed" ? "Station closed" : "Hours unavailable";
  const pick = Math.min(qty, Math.max(1, max));

  const handleAdd = () => {
    if (closed || soldOut) return;
    const add = () => {
      addItem({ businessId, productId: product.id, quantity: pick });
      toast({ kind: "success", title: "Added to cart", message: `${pick} × ${product.name}` });
      setQty(1);
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
        setFlying(false);
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
        className="relative block aspect-[4/3] overflow-hidden bg-muted"
      >
        <Image
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

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-1 text-[15px] font-semibold leading-snug text-foreground">
          <Link href={href} className="rounded-sm hover:text-[#0052FF] hover:underline focus-visible:outline-2 focus-visible:outline-[#0052FF]">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-foreground">{formatKES(product.price)}</span>
          <span className="font-mono text-[11px] uppercase text-muted-foreground">/ {product.unit}</span>
          {product.oldPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatKES(product.oldPrice)}</span>
          )}
        </div>

        <div className="mt-auto pt-4">
          {soldOut ? (
            <Button disabled className="h-11 w-full">
              Out of stock
            </Button>
          ) : closed ? (
            <Button disabled className="h-11 w-full">
              {closedLabel}
            </Button>
          ) : cartItem ? (
            <QuantityStepper
              value={cartItem.quantity}
              min={0}
              max={max}
              label={product.name}
              display={`${cartItem.quantity} in cart`}
              onChange={(n) => updateQuantity(businessId, product.id, n)}
              className="w-full justify-between bg-muted/50"
            />
          ) : (
            <div className="flex items-center gap-2">
              <QuantityStepper value={pick} max={max} label={product.name} onChange={setQty} size="sm" />
              <Button
                onClick={handleAdd}
                disabled={flying}
                className="h-11 flex-1"
                aria-label={`Add ${pick} ${product.name} to cart`}
              >
                <ShoppingCart className="size-4" aria-hidden />
                Add
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
