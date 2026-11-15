"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { shouldShowFooter } from "@/lib/footer";
import { MajiMark } from "@/components/layout/maji-mark";

const COLUMNS = [
  {
    title: "Order",
    links: [
      { href: "/browse", label: "Stations" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/account/orders", label: "Track an order" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About MajiFlow" },
      { href: "/for-business", label: "For stations" },
      { href: "/pricing", label: "Station pricing" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/faqs", label: "FAQs" },
      { href: "/contact", label: "Contact us" },
    ],
  },
] as const;

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

/**
 * Site footer: the brand, three short link columns and the legal line. Static
 * on purpose - no marquee or moving scenery under the ordering pages.
 */
export function Footer() {
  const pathname = usePathname();
  if (!shouldShowFooter(pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="mt-4 bg-gradient-to-b from-[var(--footer-top)] to-[var(--footer-bottom)] text-[var(--footer-copy)]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pb-8 pt-12 sm:px-6 lg:grid-cols-[1.3fr_2fr] lg:gap-16 lg:pt-16">
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            aria-label="MajiFlow home"
            className="inline-flex items-center gap-2.5 self-start rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--footer-sky)]"
          >
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-md">
              <MajiMark />
            </span>
            <span className="font-display text-2xl font-bold text-white">MajiFlow</span>
          </Link>
          <p className="max-w-xs text-[15px] leading-relaxed text-[var(--footer-muted)]">
            Clean drinking water from local refill stations, delivered to your door. Pay when it arrives.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--footer-sky)]">{column.title}</h2>
              <ul className="flex flex-col gap-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 items-center rounded-sm text-[15px] text-[var(--footer-copy)] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--footer-sky)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-[13px] text-[var(--footer-muted)] sm:px-6">
          <p>© {year} MajiFlow</p>
          <ul className="flex items-center gap-5">
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-9 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--footer-sky)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
