"use client";

import Link from "next/link";
import Image from "next/image";

const CATEGORIES = [
  {
    id: "refills",
    label: "Refills",
    href: "/browse?category=refills",
    image: "/categories/refills.jpg",
    alt: "Reusable bottle being filled at a filtered water tap",
  },
  {
    id: "new-bottles",
    label: "New bottles",
    href: "/browse?category=new-bottles",
    image: "/categories/new-bottles.jpg",
    alt: "Three clear water bottles filled with drinking water",
  },
  {
    id: "bottled-packs",
    label: "Bottled packs",
    href: "/browse?category=bottled-packs",
    image: "/categories/bottled-packs.jpg",
    alt: "Rows of blue-capped bottled water grouped together",
  },
  {
    id: "dispensers",
    label: "Dispensers",
    href: "/browse?category=dispensers",
    image: "/categories/dispensers.jpg",
    alt: "A clear bottle fitted to a water dispenser",
  },
];

export function BrowseCategories() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Browse Categories</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={cat.href}
            className="group relative overflow-hidden rounded-2xl bg-muted"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={cat.image}
                alt={cat.alt}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
                sizes="(min-width: 1024px) 25vw, 50vw"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="text-sm font-semibold text-white">{cat.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
