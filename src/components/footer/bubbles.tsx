import type { CSSProperties } from "react";

type BubbleStyle = CSSProperties & {
  "--left": string;
  "--size": string;
  "--delay": string;
  "--duration": string;
  "--drift": string;
  "--drift-reverse": string;
};

const BUBBLES = Array.from({ length: 22 }, (_, index) => {
  const random = (seed: number) => {
    const value = Math.sin(index * 999 + seed * 77) * 10000;
    return value - Math.floor(value);
  };

  return {
    left: 4 + random(1) * 92,
    size: 4 + random(2) * 14,
    delay: -random(3) * 12,
    duration: 7 + random(4) * 8,
    drift: (random(5) - 0.5) * 40,
  };
});

export function Bubbles() {
  return (
    <div className="mf-bubbles" aria-hidden="true">
      {BUBBLES.map((bubble, index) => {
        const style: BubbleStyle = {
          "--left": `${bubble.left.toFixed(2)}%`,
          "--size": `${bubble.size.toFixed(1)}px`,
          "--delay": `${bubble.delay.toFixed(2)}s`,
          "--duration": `${bubble.duration.toFixed(2)}s`,
          "--drift": `${bubble.drift.toFixed(1)}px`,
          "--drift-reverse": `${(-bubble.drift).toFixed(1)}px`,
        };

        return <span key={index} style={style} />;
      })}
    </div>
  );
}

export default Bubbles;
