"use client";

import { useState } from "react";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface BarPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

interface DailyBarChartProps {
  title: string;
  points: BarPoint[];
  /** Counts print as plain numbers, money in compact shillings. */
  kind: "count" | "money";
  /** Short unit for the screen-reader summary, e.g. "orders". */
  unit: string;
}

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-KE", { ...opts, timeZone: "UTC" });

/** A round axis maximum: 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/**
 * One series per day as thin bars on a zero baseline. Hover or focus a day for
 * its exact value; the table underneath carries the same numbers for anyone
 * not reading the bars.
 */
export function DailyBarChart({ title, points, kind, unit }: DailyBarChartProps) {
  const format = (value: number) =>
    kind === "money" ? formatKES(value, { compact: true }) : value.toLocaleString("en-KE", { maximumFractionDigits: 1 });
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const peak = points.reduce<BarPoint | null>((best, p) => (!best || p.value > best.value ? p : best), null);
  const ticks = [max, max / 2, 0];
  const shown = active !== null ? points[active] : null;
  const gap = points.length > 45 ? "gap-px" : "gap-[2px]";

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">
          {shown ? (
            <>
              <span className="font-semibold text-foreground">{format(shown.value)}</span> on {dayLabel(shown.date, { weekday: "short", day: "numeric", month: "short" })}
            </>
          ) : (
            <>
              Total <span className="font-semibold text-foreground">{format(total)}</span>
            </>
          )}
        </span>
      </figcaption>

      <div className="mt-4 flex gap-2">
        <div className="flex h-40 flex-col justify-between pb-px text-right font-mono text-[11px] leading-none text-muted-foreground" aria-hidden>
          {ticks.map((t) => (
            <span key={t}>{format(t)}</span>
          ))}
        </div>
        <div className="relative h-40 min-w-0 flex-1">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-border" />
          </div>
          <div
            className={cn("relative flex h-full items-end", gap)}
            role="img"
            aria-label={`${title}: ${format(total)} ${unit} over ${points.length} days${peak && peak.value > 0 ? `, peak ${format(peak.value)} on ${dayLabel(peak.date)}` : ""}.`}
            onMouseLeave={() => setActive(null)}
          >
            {points.map((p, i) => {
              const height = (p.value / max) * 100;
              return (
                <div
                  key={p.date}
                  className="flex h-full min-w-0 flex-1 items-end"
                  onMouseEnter={() => setActive(i)}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-[4px] transition-colors",
                      active === null || active === i ? "bg-[var(--brand)]" : "bg-[var(--brand)]/35"
                    )}
                    style={{ height: p.value > 0 ? `max(${height}%, 2px)` : 0 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="ml-auto mt-2 flex justify-between pl-10 font-mono text-[11px] text-muted-foreground" aria-hidden>
        <span>{points[0] ? dayLabel(points[0].date) : ""}</span>
        <span>{points.length ? dayLabel(points[points.length - 1].date) : ""}</span>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Day</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t border-border">
                  <td className="px-3 py-1.5">{dayLabel(p.date, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
