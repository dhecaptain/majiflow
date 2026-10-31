import Link from "next/link";
import { Button } from "@/components/ui/button";

export function VendorBanner() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start gap-4 rounded-3xl border border-border bg-white px-6 py-8 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            Own a refill station? Join MajiFlow
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            Grow your business with doorstep orders and a simple dashboard.
          </p>
        </div>
        <Link href="/for-business">
          <Button size="lg" className="rounded-full" style={{ backgroundColor: "var(--brand)" }}>
            Get started
          </Button>
        </Link>
      </div>
    </section>
  );
}
