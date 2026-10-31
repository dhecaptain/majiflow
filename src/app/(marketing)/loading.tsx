import { Container } from "@/components/ui/container";
import { SkeletonBlock } from "@/components/ui/skeleton-card";
import { RouteProgressTrigger } from "@/components/motion/top-progress-bar";

/**
 * Shown while any marketing or ordering page loads (home, browse, cart,
 * checkout, tracking), so it stays neutral: a heading and content blocks,
 * not one particular page's layout.
 */
export default function Loading() {
  return (
    <>
      <RouteProgressTrigger />
      <Container className="py-10 lg:py-14" aria-busy="true" aria-label="Loading">
        <div className="max-w-xl space-y-3">
          <SkeletonBlock className="h-4 w-28 rounded-full" />
          <SkeletonBlock className="h-9 w-3/4" />
          <SkeletonBlock className="h-4 w-2/3" />
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </Container>
    </>
  );
}
