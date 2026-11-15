import Image from "next/image";
import Link from "next/link";
import { Droplet, X } from "lucide-react";
import waterCansBg from "@/assets/images/hero/water-cans-bg.webp";
import { PageTransition } from "@/components/layout/page-transition";

/**
 * Sign-in and sign-up. On a phone a brand band sits above a white sheet that
 * holds the form; on a wide screen the band becomes the left half and the
 * form is centred in the right half.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-white lg:grid lg:grid-cols-2">
      <div className="relative isolate h-[250px] overflow-hidden bg-[var(--brand)] text-white lg:sticky lg:top-0 lg:h-[100svh]">
        <Image
          src={waterCansBg}
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          preload
          aria-hidden
          className="pointer-events-none -z-10 object-cover opacity-35"
        />
        <Link
          href="/"
          aria-label="Close and go to the home page"
          className="absolute left-4 top-3.5 flex size-11 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 lg:left-10 lg:top-8"
        >
          <X className="size-5" aria-hidden />
        </Link>
        <div className="absolute bottom-11 left-5 flex flex-col gap-6 lg:bottom-14 lg:left-12 lg:right-12">
          <span className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-md bg-white text-[var(--brand)]">
              <Droplet className="size-[22px]" fill="currentColor" strokeWidth={0} aria-hidden />
            </span>
            <span className="font-display text-2xl font-bold">MajiFlow</span>
          </span>
          <div className="hidden max-w-md lg:block">
            <p className="font-display text-[2.75rem] font-bold leading-[1.08]">Clean water, at your door.</p>
            <p className="mt-3 text-lg leading-relaxed text-white/80">
              Order from verified refill stations near you, see the delivery fee before you pay, and follow
              every order to your door.
            </p>
          </div>
        </div>
      </div>

      <div className="relative -mt-6 rounded-t-2xl bg-white px-5 pb-12 pt-6 sm:px-8 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:px-12 lg:py-16">
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-md outline-none">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
