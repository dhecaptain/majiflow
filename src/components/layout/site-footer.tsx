import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { Container } from "@/components/ui/container";

const customerLinks = [
  { href: "/how-it-works", label: "How ordering works" },
  { href: "/browse", label: "Browse stations" },
  { href: "/register", label: "Create an account" },
  { href: "/cart", label: "Your cart" },
  { href: "/faqs", label: "Customer FAQs" },
];

const businessLinks = [
  { href: "/for-business", label: "Why MajiFlow" },
  { href: "/business/register", label: "Register your business" },
  { href: "/pricing", label: "Plans & pricing" },
  { href: "/business", label: "Station dashboard" },
  { href: "/faqs#businesses", label: "Business FAQs" },
];

const companyLinks = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-white text-muted-foreground">
      <Container className="pb-28 pt-16 lg:pb-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 max-w-sm sm:col-span-3 lg:col-span-1">
            <BrandMark showTagline />
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              MajiFlow connects homes to independent water refill stations and gives those
              businesses a storefront and back office to take orders, track deliveries and grow.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:border-[#4D7CFF] hover:bg-muted hover:text-foreground"
            >
              Contact us
            </Link>
          </div>

          <FooterCol title="Customers" links={customerLinks} />
          <FooterCol title="Businesses" links={businessLinks} />
          <FooterCol title="Company" links={companyLinks} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} MajiFlow. All rights reserved.</p>
          <p className="font-mono uppercase tracking-widest">Clean water, delivered simply</p>
        </div>
      </Container>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
