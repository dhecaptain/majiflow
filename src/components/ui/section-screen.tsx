import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";

interface SectionScreenProps {
  children: ReactNode;
  /** Anchor id for in-page links. */
  id?: string;
  /** Extra classes for the outer <section>. */
  className?: string;
  /** Max width passed to the inner Container (default: lg). */
  containerSize?: "sm" | "md" | "lg" | "full";
  /** Extra classes for the inner Container. */
  containerClassName?: string;
  /**
   * Vertically center the content within the viewport-height section.
   * Disable for sections whose content is taller than a screen.
   */
  center?: boolean;
}

/**
 * Full-viewport marketing section. Content fills the whole screen on desktop
 * while still growing naturally past it when the content is taller, so nothing
 * is ever clipped on small screens.
 */
export function SectionScreen({
  children,
  id,
  className,
  containerSize = "lg",
  containerClassName,
  center = true,
}: SectionScreenProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative flex min-h-[100svh] w-full scroll-mt-16 flex-col py-20 lg:py-24",
        center && "justify-center",
        className
      )}
    >
      <Container size={containerSize} className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}
