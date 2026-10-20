import { cn } from "@/lib/utils";

export function MajiMark({ className, tone = "accent" }: { className?: string; tone?: "accent" | "plain" }) {
  const glyph = tone === "accent" ? "#ffffff" : "currentColor";
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-full", className)}>
      <defs>
        <linearGradient id="maji-mark-bg" x1="3" y1="1" x2="29" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3d86ff" />
          <stop offset="1" stopColor="#0052ff" />
        </linearGradient>
        <linearGradient id="maji-mark-drop" x1="11" y1="8" x2="21" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor={glyph} stopOpacity="0.98" />
          <stop offset="1" stopColor={glyph} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#maji-mark-bg)" />
      <path
        d="M16 7.4c2.9 4 4.9 6.6 4.9 9.2a4.9 4.9 0 1 1-9.8 0c0-2.6 2-5.2 4.9-9.2z"
        fill="url(#maji-mark-drop)"
      />
      <path
        d="M12.6 24.2c1.1.7 2.2 1 3.4 1s2.3-.3 3.4-1"
        stroke={glyph}
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14.2 26.4c.6.3 1.2.5 1.8.5s1.2-.2 1.8-.5"
        stroke={glyph}
        strokeOpacity="0.22"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
