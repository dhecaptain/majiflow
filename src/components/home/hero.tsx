"use client";

import Image from "next/image";
import waterCansBg from "@/assets/images/hero/water-cans-bg.webp";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "@/lib/constants";
import { ParallaxBackdrop } from "@/components/ui/parallax-backdrop";
import { OrderCard } from "@/components/home/order-card";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-black lg:h-[866px] lg:min-h-[640px] lg:justify-center">
      {/* Full-bleed photo on desktop; a top banner on mobile. */}
      <div className="relative h-[270px] w-full shrink-0 overflow-hidden lg:absolute lg:inset-0 lg:h-full">
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
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 88%, #000 100%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[90rem] flex-1 items-center px-5 py-10 sm:px-8 lg:flex-none lg:justify-start lg:py-0 lg:pl-12 lg:pr-12">
        <motion.div
          initial={reduce ? false : { y: 24 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: easeOut }}
          className="w-full lg:w-[608px]"
        >
          <OrderCard />
        </motion.div>
      </div>
    </section>
  );
}
