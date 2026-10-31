"use client";

import { Check, Clock, MapPin, Navigation, Star, Truck, Zap, type LucideIcon } from "lucide-react";
import type { BrowseStep } from "@/components/order/browse-context";

export type BrowseJourneyStep = BrowseStep;
export type BrowseSortMode = "recommended" | "distance" | "fastest" | "rating";

const STEPS: { id: BrowseJourneyStep | "order"; label: string }[] = [
  { id: "order", label: "Order" },
  { id: "location", label: "Map/Location" },
  { id: "station", label: "Station" },
  { id: "cart", label: "Add to Cart" },
];

const SORT_OPTIONS: { id: BrowseSortMode; label: string; icon: LucideIcon }[] = [
  { id: "recommended", label: "Recommended", icon: Navigation },
  { id: "distance", label: "Nearest", icon: MapPin },
  { id: "fastest", label: "Fastest", icon: Zap },
  { id: "rating", label: "Top rated", icon: Star },
];

export function BrowseSidebar({
  currentStep,
  canGoToStep,
  onSelectStep,
  sort,
  onSortChange,
  openOnly,
  onOpenOnlyChange,
  freeOnly,
  onFreeOnlyChange,
}: {
  currentStep: BrowseJourneyStep;
  canGoToStep: (step: BrowseJourneyStep) => boolean;
  onSelectStep: (step: BrowseJourneyStep) => void;
  sort: BrowseSortMode;
  onSortChange: (sort: BrowseSortMode) => void;
  openOnly: boolean;
  onOpenOnlyChange: (active: boolean) => void;
  freeOnly: boolean;
  onFreeOnlyChange: (active: boolean) => void;
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);
  const stationStep = currentStep === "station";

  return (
    <>
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-40 border-b border-border bg-white md:top-[calc(5.625rem+env(safe-area-inset-top))] lg:hidden">
        <nav aria-label="Order steps" className="overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol className="flex w-max min-w-full items-center gap-6" aria-label="Steps">
            {STEPS.map((step, index) => (
              <BrowseStepItem
                key={step.id}
                label={step.label}
                index={index}
                currentIndex={currentIndex}
                canSelect={canGoToStep(step.id)}
                onSelect={() => onSelectStep(step.id)}
                mobile
              />
            ))}
          </ol>
        </nav>
        {stationStep && (
          <div className="border-t border-border px-4 py-2">
            <MobileStationFilters
              sort={sort}
              onSortChange={onSortChange}
              openOnly={openOnly}
              onOpenOnlyChange={onOpenOnlyChange}
              freeOnly={freeOnly}
              onFreeOnlyChange={onFreeOnlyChange}
            />
          </div>
        )}
      </div>

      <aside className="sticky top-[calc(5.625rem+env(safe-area-inset-top))] hidden h-[calc(100dvh-5.625rem-env(safe-area-inset-top))] w-[475px] shrink-0 overflow-y-auto border-r border-border bg-white lg:block">
        <div className="ml-auto w-full max-w-[260px] py-8 pr-8">
          <h2 className="font-display text-3xl font-bold leading-tight text-foreground">Steps</h2>
          <nav aria-label="Order steps" className="mt-7">
            <ol className="space-y-5">
              {STEPS.map((step, index) => (
                <BrowseStepItem
                  key={step.id}
                  label={step.label}
                  index={index}
                  currentIndex={currentIndex}
                  canSelect={canGoToStep(step.id)}
                  onSelect={() => onSelectStep(step.id)}
                />
              ))}
            </ol>
          </nav>

          {stationStep && (
            <>
              <div aria-hidden className="my-6 w-12 border-t border-border" />
              <nav aria-label="Station filters" className="space-y-1">
                {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <SidebarFilter
                    key={id}
                    label={label}
                    icon={Icon}
                    active={sort === id}
                    onClick={() => onSortChange(id)}
                  />
                ))}
                <SidebarFilter
                  label="Open now"
                  icon={Clock}
                  active={openOnly}
                  onClick={() => onOpenOnlyChange(!openOnly)}
                />
                <SidebarFilter
                  label="Free delivery"
                  icon={Truck}
                  active={freeOnly}
                  onClick={() => onFreeOnlyChange(!freeOnly)}
                />
              </nav>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function BrowseStepItem({
  label,
  index,
  currentIndex,
  canSelect,
  onSelect,
  mobile = false,
}: {
  label: string;
  index: number;
  currentIndex: number;
  canSelect: boolean;
  onSelect: () => void;
  mobile?: boolean;
}) {
  const done = index < currentIndex;
  const current = index === currentIndex;
  const future = !canSelect && !current;
  const className = [
    "relative inline-flex items-center gap-2.5 whitespace-nowrap text-left transition-colors",
    mobile ? "min-h-14 border-b-2 px-1 text-sm" : "min-h-8 border-b-2 pb-1 text-base",
    done ? "border-transparent font-semibold text-foreground hover:text-brand" : "",
    current ? "border-brand font-bold text-brand" : "",
    future ? "border-transparent font-medium text-muted-foreground/60" : "",
  ].join(" ");
  const content = (
    <>
      <span className="flex size-4 shrink-0 items-center justify-center">
        {done ? <Check className="size-4 text-brand" aria-hidden /> : null}
      </span>
      <span>{label}</span>
    </>
  );

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={current || !canSelect}
        className={className}
        aria-current={current ? "step" : undefined}
        aria-disabled={future ? true : undefined}
      >
        {content}
      </button>
    </li>
  );
}

function SidebarFilter({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition-colors hover:bg-muted ${
        active ? "font-semibold text-brand" : "font-medium text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
      {active ? <Check className="ml-auto size-4 shrink-0" aria-hidden /> : null}
    </button>
  );
}

function MobileStationFilters({
  sort,
  onSortChange,
  openOnly,
  onOpenOnlyChange,
  freeOnly,
  onFreeOnlyChange,
}: {
  sort: BrowseSortMode;
  onSortChange: (sort: BrowseSortMode) => void;
  openOnly: boolean;
  onOpenOnlyChange: (active: boolean) => void;
  freeOnly: boolean;
  onFreeOnlyChange: (active: boolean) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Station filters">
      {SORT_OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = sort === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSortChange(id)}
            aria-pressed={active}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
              active ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground hover:border-brand/40"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onOpenOnlyChange(!openOnly)}
        aria-pressed={openOnly}
        className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
          openOnly ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground hover:border-brand/40"
        }`}
      >
        <Clock className="size-3.5" aria-hidden /> Open now
      </button>
      <button
        type="button"
        onClick={() => onFreeOnlyChange(!freeOnly)}
        aria-pressed={freeOnly}
        className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
          freeOnly ? "border-brand bg-brand text-white" : "border-border bg-white text-foreground hover:border-brand/40"
        }`}
      >
        <Truck className="size-3.5" aria-hidden /> Free delivery
      </button>
    </div>
  );
}
