import Link from "next/link";
import { Droplets } from "lucide-react";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex min-h-[75vh] flex-col items-center justify-center gap-6 py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-accent">
        <Droplets className="size-8" aria-hidden />
      </span>
      <p className="text-gradient font-display text-6xl font-black tracking-tight">404</p>
      <h1 className="font-display text-3xl text-foreground sm:text-4xl">This page drifted away</h1>
      <p className="max-w-md text-muted-foreground">
        The link may be broken or the page moved. Let us get you back to the water.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
          Back home
        </Link>
        <Link href="/browse" className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}>
          Browse stations
        </Link>
      </div>
    </Container>
  );
}
