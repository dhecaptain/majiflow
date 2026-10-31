import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ButtonLoader } from "@/components/ui/button-loader";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "select-none transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200",
    "hover:[&_svg]:translate-x-0.5 group-hover:[&_svg]:translate-x-0.5",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--brand)] text-white shadow-accent hover:shadow-[0_16px_44px_-10px_rgba(0,87,230,0.6)] hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "border border-border bg-card text-foreground shadow-card hover:border-border hover:bg-muted hover:-translate-y-0.5",
        outline:
          "border border-[var(--brand)]/40 text-[var(--brand)] bg-transparent hover:border-[var(--brand)] hover:bg-brand/5",
        danger:
          "bg-danger text-white shadow-soft hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0",
        ghost: "text-foreground hover:bg-muted",
        dark: "bg-white text-ink hover:bg-slate-100 hover:-translate-y-0.5 shadow-card",
        link: "text-[var(--brand)] underline-offset-4 hover:underline",
      },
      size: {
        md: "h-11 rounded-lg px-5 text-sm",
        lg: "h-12 rounded-xl px-6 text-[15px] min-h-11",
        sm: "h-9 rounded-md px-3.5 text-sm",
        icon: "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a thin brand-coloured ring and fades the label out. */
  loading?: boolean;
  /** Swaps the ring for a tick once the action has succeeded. */
  success?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, type = "button", loading = false, success = false, disabled, children, ...props },
    ref
  ) => {
    const busy = loading || success;
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        <span
          className={cn(
            "inline-flex items-center gap-2 transition-opacity duration-200",
            busy ? "pointer-events-none opacity-0" : "opacity-100"
          )}
        >
          {children}
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center">
            <ButtonLoader state={success ? "success" : "loading"} className="size-4" />
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };