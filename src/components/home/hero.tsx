"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import waterCansBg from "@/assets/images/hero/water-cans-bg.webp";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  MessageCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { CITIES, easeOut } from "@/lib/constants";
import { ParallaxBackdrop } from "@/components/ui/parallax-backdrop";
import { RotatingWord } from "@/components/home/rotating-word";

const HERO_WORDS = ["delivered", "refilled", "tracked", "at your door"] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const [city, setCity] = useState("Nairobi");

  return (
    <section className="relative overflow-hidden">
      <ParallaxBackdrop strength={30} className="absolute inset-0">
        <Image
          src={waterCansBg}
          alt=""
          fill
          sizes="100vw"
          preload
          aria-hidden
          className="pointer-events-none scale-110 object-cover"
        />
      </ParallaxBackdrop>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/20"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-glow" />

      <div className="relative mx-auto w-full max-w-[72rem] px-5 pb-24 pt-14 sm:px-8 lg:pb-32 lg:pt-20">
        {/* Copy */}
        <div className="max-w-[42rem]">
          <motion.div
            initial={reduce ? false : { y: 20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            <SectionLabel pulse>
              Trusted water, ordered in seconds
            </SectionLabel>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { y: 28 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: easeOut }}
            className="mt-5 font-display text-[2.75rem] leading-[1.06] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]"
          >
            Clean water,{" "}
            <RotatingWord words={HERO_WORDS} className="text-gradient" /> from refill
            stations near you.
          </motion.h1>

          <motion.p
            initial={reduce ? false : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: easeOut }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Order clean, affordable drinking water from trusted refill businesses in your estate.
            Pay with M-Pesa, track the rider, and get your cans at the door — no lifting, no waiting.
          </motion.p>

          <motion.div
            initial={reduce ? false : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.28, ease: easeOut }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-white p-1.5 shadow-card sm:max-w-sm">
              <MapPin className="ml-2.5 size-5 shrink-0 text-[#0052FF]" aria-hidden />
              <label htmlFor="hero-city" className="sr-only">
                Choose your city
              </label>
              <select
                id="hero-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-11 w-full rounded-lg bg-transparent text-sm font-medium text-foreground focus:outline-none"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Link href={`/browse?city=${encodeURIComponent(city)}`} className="shrink-0">
                <Button size="lg" className="group px-5">
                  Order water
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
            </div>
          </motion.div>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-success" aria-hidden /> Verified stations
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-4 text-[#0052FF]" aria-hidden /> Real-time tracking
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-4 text-warning" aria-hidden /> Delivery in ~40 min
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
