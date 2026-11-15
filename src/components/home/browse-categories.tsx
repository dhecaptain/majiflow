import Link from "next/link";
import Image from "next/image";
import { WATER_CATEGORY_LABELS, type WaterCategoryId } from "@/lib/categories";

const CATEGORIES: { id: WaterCategoryId; note: string; image: string }[] = [
  { id: "refills", note: "Top up your own can", image: "/categories/refills.jpg" },
  { id: "new-bottles", note: "Sealed and ready", image: "/categories/new-bottles.jpg" },
  { id: "bottled-packs", note: "Small bottles, multipacks", image: "/categories/bottled-packs.jpg" },
  { id: "dispensers", note: "Buy or rent", image: "/categories/dispensers.jpg" },
];

/** "What do you need?": four square tiles on a phone, four wide cards on a desktop. */
export function BrowseCategories() {
  return (
    <section aria-labelledby="need-title" className="mx-auto w-full max-w-[1200px] px-4 pt-7 sm:px-6 lg:pt-14">
      <h2 id="need-title" className="text-lg font-extrabold tracking-tight text-foreground lg:text-2xl">
        What do you need?
      </h2>
      <ul className="mt-3 grid grid-cols-4 gap-2.5 lg:mt-4 lg:gap-4">
        {CATEGORIES.map((cat) => (
          <li key={cat.id}>
            <Link
              href={`/browse?category=${cat.id}`}
              className="group flex flex-col items-center gap-2 rounded-lg text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] lg:flex-row lg:gap-3.5 lg:border lg:border-border lg:p-3 lg:transition-colors lg:hover:border-[var(--brand)]/40 lg:hover:bg-surface-2"
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-3 lg:size-[72px] lg:w-[72px] lg:shrink-0 lg:rounded-md">
                <Image
                  src={cat.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 72px, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="flex flex-col text-center lg:text-left">
                <span className="text-[12.5px] font-semibold leading-tight lg:text-base lg:font-bold">
                  {WATER_CATEGORY_LABELS[cat.id]}
                </span>
                <span className="hidden text-[13px] text-muted-foreground lg:block">{cat.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
