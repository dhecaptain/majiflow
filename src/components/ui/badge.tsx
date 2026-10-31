import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "border-border bg-white text-foreground",
        accent: "border-transparent bg-[var(--brand)] text-white shadow-accent",
        softAccent: "border-[var(--brand)]/15 bg-brand/10 text-[var(--brand)]",
        muted: "border-transparent bg-muted text-muted-foreground",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        danger: "border-transparent bg-danger-soft text-danger",
        dark: "border-white/10 bg-ink text-white",
        mono: "border-border bg-muted font-mono text-[11px] uppercase tracking-wider text-muted-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };