import { ButtonLoader } from "@/components/ui/button-loader";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/**
 * A calm, brand-coloured waiting state for content we cannot shape into a
 * skeleton yet.
 */
export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-4 py-16 text-center", className)}
    >
      <ButtonLoader className="size-7 text-[var(--brand)]" label={label} />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center", className)}>
      {icon && (
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-danger/25 bg-danger/10 px-6 py-12 text-center"
    >
      <h3 className="font-display text-xl text-danger">{title}</h3>
      <p className="max-w-sm text-sm text-foreground/80">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
