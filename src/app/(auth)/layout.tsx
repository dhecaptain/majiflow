import Image from "next/image";
import waterCansBg from "@/assets/images/hero/water-cans-bg.webp";
import { PageTransition } from "@/components/layout/page-transition";
import { SiteHeader } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100svh] bg-black">
      <SiteHeader />
      <Image
        src={waterCansBg}
        alt=""
        fill
        sizes="100vw"
        preload
        aria-hidden
        className="pointer-events-none object-cover"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/60"
      />
      <div className="relative z-10 flex min-h-[calc(100svh-4rem)] w-full flex-col items-center justify-center px-5 pb-14 pt-8 md:min-h-[calc(100svh-5.625rem)] sm:px-8">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
