import { SkeletonBlock } from "@/components/ui/skeleton-card";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-16" aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="h-8 w-2/3" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-12 w-full rounded-xl" />
      <SkeletonBlock className="h-12 w-full rounded-xl" />
    </div>
  );
}
