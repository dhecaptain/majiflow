import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SectionScreen } from "@/components/ui/section-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { AnimatedSection, Stagger, StaggerItem } from "@/components/ui/animated-section";

const checklist = [
  "Accept or reject orders and move them to delivered",
  "Set a delivery fee and free-delivery minimum per station",
  "Stock alerts before a product runs out",
  "A customer list with order history and repeat rate",
  "Sales charts and popular products from stored orders",
];

export function DashboardFeature() {
  return (
    <SectionScreen className="bg-card" containerSize="md">
      <SectionHeading
        label="The business dashboard"
        title={
          <>
            A dashboard built for a{" "}
            <span className="text-gradient">busy station</span>
          </>
        }
        description="Run orders, stock and customers from one place."
      />
      <Stagger className="mt-10 grid gap-3 sm:grid-cols-2" stagger={0.06}>
        {checklist.map((c) => (
          <StaggerItem key={c}>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <p className="text-sm leading-relaxed text-foreground/85">{c}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
      <AnimatedSection delay={0.2} className="mt-9 flex justify-center">
        <Link href="/business">
          <Button size="lg" className="group">
            Open the dashboard
          </Button>
        </Link>
      </AnimatedSection>
    </SectionScreen>
  );
}
