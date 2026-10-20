import { cn } from "@/lib/utils";

export function WaterDroplets({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-14 w-20", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute top-0 size-2.5 rounded-full bg-[#0052FF]"
          style={{
            left: `${30 + i * 20}%`,
            animation: `drop-fall 1.5s ${i * 0.22}s cubic-bezier(0.45, 0, 0.9, 0.4) infinite`,
          }}
        />
      ))}
      <span className="absolute bottom-1 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[#0052FF]/15" />
      <span
        className="absolute bottom-1 left-1/2 size-10 rounded-full border-2 border-[#0052FF]/40"
        style={{ animation: "puddle-ripple 1.5s ease-out infinite" }}
      />
      <span
        className="absolute bottom-1 left-1/2 size-10 rounded-full border-2 border-[#0052FF]/25"
        style={{ animation: "puddle-ripple 1.5s 0.5s ease-out infinite" }}
      />
    </div>
  );
}

export function WaterLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <WaterDroplets />
      <p className="text-sm font-medium text-muted-foreground">{label}…</p>
    </div>
  );
}
