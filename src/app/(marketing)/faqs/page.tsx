import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
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
    { id: "customers", label: "Customers", headline: "Ordering & delivery", items: faqsByGroup("customers") },
    { id: "businesses", label: "Businesses", headline: "Running your station", items: faqsByGroup("businesses") },
    { id: "billing", label: "Billing", headline: "Plans, trials & payments", items: faqsByGroup("billing") },
  ] as const;

  return (
    <>
      <PageHero
        label="FAQs"
        pulseLabel
        title={
          <>
            Every answer, <span className="text-gradient">one page</span>
          </>
        }
        description="From ordering your first refill to running five staff on the Growth plan - the questions we actually get."
      />

      <section className="py-16 lg:py-24">
        <Container size="md">
          <div className="flex flex-col gap-14">
            {groups.map((g) => (
              <div key={g.id} id={g.id} className="scroll-mt-24">
                <SectionHeading align="left" label={g.label} title={g.headline} className="mb-8" />
                <div className="flex flex-col gap-3">
                  {g.items.map((f) => (
                    <AccordionItem key={f.id} value={f.id} question={f.question}>
                      {f.answer}
                    </AccordionItem>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}