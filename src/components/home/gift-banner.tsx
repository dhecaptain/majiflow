import Image from "next/image";
import waterCansBg from "@/assets/images/hero/water-cans-bg.webp";
import { SendWaterTrigger } from "@/components/order/send-water-trigger";

export function GiftBanner() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <Image src={waterCansBg} alt="" fill className="object-cover opacity-70" sizes="100vw" />
        <div className="relative flex flex-col items-start gap-4 p-6 sm:p-10 lg:p-12">
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">
            Give the gift of fresh water
          </h2>
          <p className="max-w-[520px] text-white/90">
            Send fresh water to someone’s door. A simple, thoughtful way to care for family and friends.
          </p>
          <SendWaterTrigger size="lg" className="rounded-full" style={{ backgroundColor: "var(--brand)" }}>
            Send water
          </SendWaterTrigger>
        </div>
      </div>
    </section>
  );
}
