import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHero, PageSection } from "@/components/shared/page-hero";
import { AccordionItem } from "@/components/ui/accordion";
import { faqsByGroup } from "@/lib/data/faqs";

export const metadata = {
  title: "FAQs",
  description:
    "Answers about ordering water, delivery fees, payments, and running a refill station on MajiFlow.",
  alternates: { canonical: "/faqs" },
};

export default function Faqs() {
  const groups = [
    { id: "customers", label: "Ordering & delivery", items: faqsByGroup("customers") },
    { id: "businesses", label: "Running a station", items: faqsByGroup("businesses") },
    { id: "billing", label: "Plans & billing", items: faqsByGroup("billing") },
  ] as const;

  const help = (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-5">
      <span className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-[var(--brand)]">
        <MessageCircle className="size-5" aria-hidden />
      </span>
      <p className="text-base font-bold text-foreground">Still need help?</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Our team replies within one business day, Monday to Saturday.
      </p>
      <Link
        href="/contact"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-sm font-bold text-white transition-colors hover:bg-[var(--cta-hover)]"
      >
        Contact support
      </Link>
    </div>
  );

  return (
    <>
      <PageHero
        label="FAQs"
        title="Questions, answered"
        description="Ordering, delivery, payments and running a station on MajiFlow."
      >
        <nav aria-label="FAQ sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-[var(--brand)]/40"
            >
              {g.label}
              <span className="rounded-full bg-surface-2 px-1.5 text-xs font-bold text-muted-foreground">{g.items.length}</span>
            </a>
          ))}
        </nav>
      </PageHero>

      <PageSection className="!pt-8 lg:!pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
          <div className="flex flex-col gap-10">
            {groups.map((g) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="scroll-mt-24">
                <h2 id={`${g.id}-title`} className="mb-4 text-xl font-extrabold tracking-tight text-foreground lg:text-2xl">
                  {g.label}
                </h2>
                <div className="flex flex-col gap-2.5">
                  {g.items.map((f, i) => (
                    <AccordionItem key={f.id} value={f.id} question={f.question} defaultOpen={g.id === "customers" && i === 0}>
                      {f.answer}
                    </AccordionItem>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">{help}</aside>
        </div>
      </PageSection>
    </>
  );
}
