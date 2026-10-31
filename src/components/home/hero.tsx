"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { easeOut } from "@/lib/constants";
import { HeroSlider } from "@/components/home/hero-slider";
import { HERO_SLIDES, HERO_SLIDE_INTERVAL } from "@/config/hero-slides";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useOrderEntry } from "@/components/order/order-entry-provider";
import { Button } from "@/components/ui/button";

export function Hero() {
  const reduce = usePrefersReducedMotion();
  const { startOrder } = useOrderEntry();

  const actions = (
    <div className="pointer-events-auto flex flex-wrap items-center gap-3 max-[379px]:gap-2">
      <Button
        size="lg"
        onClick={startOrder}
        className="rounded-full px-7 font-semibold max-[379px]:flex-1 max-[379px]:px-3 max-[379px]:text-sm"
        style={{ backgroundColor: "var(--brand)" }}
      >
        Order now
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <Link
        href="/browse"
        className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 max-[379px]:flex-1 max-[379px]:justify-center max-[379px]:px-3 max-[379px]:text-sm"
      >
        Browse stations
      </Link>
    </div>
  );

  return (
    <section className="relative isolate flex min-h-[max(70svh,520px)] w-full flex-col overflow-hidden bg-black lg:min-h-[520px]">
      <HeroSlider slides={HERO_SLIDES} interval={HERO_SLIDE_INTERVAL} />

      <div className="pointer-events-none absolute inset-x-0 top-[calc(50%_-_7.25rem)] z-20 -translate-y-1/2 px-5 lg:hidden">
        <p className="mx-auto max-w-[34rem] text-center font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white [text-shadow:0_2px_18px_rgba(2,18,40,0.8)] sm:text-5xl">
          {HERO_SLIDES[0].headline}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[34rem] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex justify-center">{actions}</div>
      </div>

      <div className="pointer-events-none relative z-20 mx-auto hidden w-full max-w-[1100px] flex-1 items-center px-4 pb-10 pt-10 sm:px-6 lg:flex lg:px-8">
        <motion.div
          initial={reduce ? false : { y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
          className="pointer-events-none max-w-[520px]"
        >
          <p className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {HERO_SLIDES[0].headline}
          </p>

          <div className="mt-7">{actions}</div>
        </motion.div>
      </div>
    </section>
  );
}
