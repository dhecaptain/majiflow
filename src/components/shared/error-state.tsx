"use client";

import Link from "next/link";
import { LifeBuoy, RotateCcw } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Honest failure screen shared by every route group's `error.tsx`: says what
 * happened, offers a retry, and never dumps a raw stack on the customer.
 */
export function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-accent">
        <LifeBuoy className="size-8" aria-hidden />
      </span>
      <div>
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">Something spilled along the way</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          We hit an unexpected error loading this page. Give it another try, or head back and start fresh.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">Ref: {error.digest}</p>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset} className="w-full gap-2 sm:w-auto">
          <RotateCcw className="size-4" aria-hidden /> Try again
        </Button>
        <Link href="/">
          <Button size="lg" variant="secondary" className="w-full sm:w-auto">
            Back home
          </Button>
        </Link>
      </div>
    </Container>
  );
}
