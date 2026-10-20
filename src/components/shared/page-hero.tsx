import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { AnimatedSection } from "@/components/ui/animated-section";

interface PageHeroProps {
  label?: string;
  pulseLabel?: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  tone?: "light" | "dark";
  align?: "center" | "left";
  className?: string;
}

/** Sticky-style page hero used across inner marketing pages. */
export function PageHero({
  title,
  description,
  children,
  tone = "light",
  align = "center",
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative flex min-h-[100svh] w-full scroll-mt-16 flex-col justify-center overflow-hidden",
        tone === "dark" ? "bg-ink text-white" : "bg-background",
        "border-b",
        tone === "dark" ? "border-white/10" : "border-border",
        className
      )}
    >
      {tone === "light" ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-glow" />
      ) : (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-40" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 60% at 82% -10%, rgba(0,82,255,0.38), transparent 62%), radial-gradient(ellipse 60% 50% at 0% 110%, rgba(77,124,255,0.18), transparent 60%)",
            }}
          />
        </>
      )}
      <Container className="relative py-20 lg:py-24">
        <AnimatedSection
          className={cn(
            "flex flex-col gap-5",
            align === "center" ? "items-center text-center" : "items-start",
            align === "center" && "mx-auto max-w-3xl"
          )}
        >
          <h1
            className={cn(
              "font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl md:text-[3.25rem]",
              tone === "dark" ? "text-white" : "text-foreground"
            )}
          >
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                "max-w-2xl text-base leading-relaxed sm:text-lg",
                tone === "dark" ? "text-slate-300" : "text-muted-foreground"
              )}
            >
              {description}
            </p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </AnimatedSection>
      </Container>
    </section>
  );
}