"use client";

import Image from "next/image";
import { ArrowRight, Banknote, MapPin } from "lucide-react";
import waterCans from "@/assets/images/hero/water-cans-bg.webp";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { addressLabel } from "@/components/layout/site-header";

/**
 * The opening of the home page. On a phone it is one compact card so the
 * categories and stations are already on screen; on a desktop it splits into
 * copy with an address field and a photo.
 */
export function Hero() {
  const { startOrder } = useOrderEntry();
  const { address } = useOrderSession();
  const location = addressLabel(address);

  return (
    <section aria-labelledby="hero-title" className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:pt-10">
      {/* Phone and tablet: one compact card. */}
      <div className="relative isolate flex min-h-[176px] overflow-hidden rounded-xl bg-[var(--brand)] text-white lg:hidden">
        <Image
          src={waterCans}
          alt=""
          priority
          sizes="60vw"
          className="absolute -right-10 top-0 -z-10 h-full w-[62%] object-cover opacity-55"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--brand)] from-45% to-transparent" />
        <div className="flex max-w-[16.5rem] flex-col gap-2 p-5">
          <h1 id="hero-title" className="font-display text-[26px] font-bold leading-[1.1]">
            Clean water, at your door.
          </h1>
          <p className="text-sm leading-relaxed text-[#e1f1ff]">
            Order from verified refill stations near you. Pay when it arrives.
          </p>
          <button
            type="button"
            onClick={startOrder}
            className="mt-1.5 inline-flex h-11 items-center gap-1.5 self-start rounded-full bg-white px-5 text-sm font-bold text-[var(--brand)] transition-transform active:scale-[0.98]"
          >
            Order water
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Desktop: copy and address on the left, photo on the right. */}
      <div className="hidden items-center gap-10 lg:flex">
        <div className="flex flex-1 flex-col gap-5">
          <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-aqua-soft px-3 text-[13px] font-bold text-[#00707d]">
            <span className="size-[7px] rounded-full bg-aqua" aria-hidden />
            Water delivery from local refill stations
          </span>
          {/* Only one of the two headings is ever displayed, so the page keeps a single h1. */}
          <h1 className="font-display text-[3.5rem] font-bold leading-[1.04] tracking-tight text-foreground">
            Clean water,
            <br />
            at your door.
          </h1>
          <p className="max-w-[32rem] text-lg leading-relaxed text-muted-foreground">
            Order from verified refill stations near you. Compare prices, choose delivery or pickup, and pay when it
            arrives.
          </p>
          <div className="flex max-w-[34rem] items-center gap-2 rounded-xl border border-border bg-white p-2 shadow-card">
            <button
              type="button"
              onClick={startOrder}
              className="flex h-13 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 text-left text-base transition-colors hover:bg-surface-2"
            >
              <MapPin className="size-5 shrink-0 text-[var(--brand)]" aria-hidden />
              <span className={location ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}>
                {location || "Enter your estate or street"}
              </span>
            </button>
            <button
              type="button"
              onClick={startOrder}
              className="inline-flex h-13 shrink-0 items-center rounded-lg bg-[var(--brand)] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[var(--cta-hover)]"
            >
              Find stations
            </button>
          </div>
        </div>

        <div className="relative h-[420px] flex-1 overflow-hidden rounded-2xl bg-[var(--brand)]">
          <Image
            src={waterCans}
            alt="Rows of 20 litre water cans at a refill station"
            fill
            priority
            sizes="(min-width: 1200px) 560px, 45vw"
            className="object-cover"
          />
          <div className="absolute bottom-5 left-5 flex max-w-[290px] items-center gap-3 rounded-lg bg-white px-4 py-3.5 shadow-float">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
              <Banknote className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Pay on delivery</span>
              <span className="text-[13px] text-muted-foreground">Cash or M-Pesa to the rider</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
