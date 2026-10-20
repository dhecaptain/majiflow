"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CitySelect } from "@/components/home/city-select";

/**
 * The hero's primary "order water" card. Follows the Yassir pattern: the
 * section title lives inside a solid white card, above two labelled inputs
 * and a single pill call to action.
 */
export function OrderCard({ defaultCity = "Nairobi" }: { defaultCity?: string }) {
  const router = useRouter();
  const [city, setCity] = useState(defaultCity);
  const [query, setQuery] = useState("");

  const href = `/browse?city=${encodeURIComponent(city)}${
    query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""
  }`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(href);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-6 rounded-2xl bg-white p-6 shadow-layered sm:p-8 lg:p-10"
    >
      <div className="flex flex-col gap-2 lg:gap-3.5">
        <h1 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
          Order water
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Hassle-free drinking water, delivered from refill stations near you.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-foreground">City</span>
          <CitySelect value={city} onChange={setCity} />
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="hero-search" className="text-sm font-semibold text-foreground">
            Estate, street or station
          </label>
          <div className="relative flex w-full items-center rounded-xl border border-border bg-white transition-colors focus-within:border-[#0052FF]">
            <Search
              className="pointer-events-none absolute left-4 size-5 text-muted-foreground"
              aria-hidden
            />
            <input
              id="hero-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Choose a location or station"
              className="h-14 w-full min-w-0 rounded-xl bg-transparent pl-12 pr-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full rounded-full">
        Order water
      </Button>
    </form>
  );
}
