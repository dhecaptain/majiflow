"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplet } from "lucide-react";
import { shouldShowFooter } from "@/lib/footer";
import { Marquee } from "@/components/ui/marquee";
import { Bubbles } from "@/components/footer/bubbles";
import { WaterWordmark } from "@/components/footer/water-wordmark";

const marqueeItems = [
  "Fresh water",
  "Delivered to your door",
  "Order in a few taps",
  "Pay with M-Pesa",
  "Track your order",
];

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  const pathname = usePathname();

  if (!shouldShowFooter(pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <>
      <div className="mf-marquee-band">
        <Marquee
          items={marqueeItems}
          speed={38}
          separator={
            <Droplet
              aria-hidden="true"
              className="size-3.5 shrink-0 text-[var(--footer-sky)]"
            />
          }
          className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90 sm:text-base lg:text-lg"
        />
      </div>

      <footer className="mf-footer">
        <div className="mf-brand">
          <div className="mf-blue" aria-hidden="true">
            <div className="mf-photo">
              <Image
                src="/images/footer-water.jpg"
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="mf-scene">
            <WaterWordmark />
            <Bubbles />
          </div>
        </div>

        <div className="mf-meta">
          <p>© {year} MajiFlow</p>
          <nav aria-label="Footer legal and contact">
            {footerLinks.map((link, index) => (
              <Fragment key={link.href}>
                {index > 0 ? <span aria-hidden="true">·</span> : null}
                <Link href={link.href}>{link.label}</Link>
              </Fragment>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}

export default Footer;
