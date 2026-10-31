import Link from "next/link";
import { CircleUser } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** Staff accounts are not available yet; owners run the dashboard themselves. */
export function BusinessStaff() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-foreground sm:text-3xl">Staff</h1>
      <EmptyState
        icon={<CircleUser className="size-6" aria-hidden />}
        title="Staff accounts are coming"
        description="For now the station owner manages orders from this dashboard. Riders get a private delivery link for each order they are assigned, so they need no account."
        action={
          <Link href="/business/orders" className={buttonVariants({ variant: "outline" })}>
            Go to orders
          </Link>
        }
      />
    </div>
  );
}
