"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMotionSafe } from "@/lib/motion";
import { BlurImage } from "@/components/ui/blur-image";

export const CART_TARGET_SELECTOR = "[data-cart-target]";

const FLY_SIZE = 44;
const FLY_DURATION = 800;
const FLY_BULGE_MIN = 48;
const FLY_BULGE_MAX = 140;

type Point = { x: number; y: number };

export type FlyOptions = {
  /** Origin element - its on-screen center becomes the flight start point. */
  fromEl: HTMLElement;
  /** Optional product image source rendered as the flying thumbnail. */
  src?: string;
  alt?: string;
  /** Optional fallback content (e.g. a cart glyph for reorder actions). */
  children?: ReactNode;
  /** Called when the flyer lands (or immediately when skipped). */
  onDone: () => void;
};

type Flight = {
  key: number;
  from: Point;
  to: Point;
  src?: string;
  alt?: string;
  children?: ReactNode;
  onDone: () => void;
};

export function getCartTarget(): HTMLElement | null {
  return typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>(CART_TARGET_SELECTOR);
}

function centerOf(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function bumpCartIcon(target: HTMLElement | null = getCartTarget()): void {
  if (!target) return;
  target.classList.add("cart-bump");
  const end = () => {
    target.classList.remove("cart-bump");
    target.removeEventListener("animationend", end);
  };
  target.addEventListener("animationend", end);
  window.setTimeout(end, 500);
}

function runFlight(el: HTMLElement, from: Point, to: Point, onDone: () => void): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bulge = Math.min(Math.max(dist * 0.28, FLY_BULGE_MIN), FLY_BULGE_MAX);
  const cx = from.x + dx / 2;
  const cy = from.y + dy / 2 - bulge;

  const steps = 28;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const px = inv * inv * from.x + 2 * inv * t * cx + t * t * to.x;
    const py = inv * inv * from.y + 2 * inv * t * cy + t * t * to.y;
    frames.push({
      transform: `translate(${px - from.x}px, ${py - from.y}px) scale(${1 - 0.65 * t})`,
      offset: t,
    });
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };

  if (typeof el.animate !== "function") {
    finish();
    return;
  }

  try {
    const animation = el.animate(frames, {
      duration: FLY_DURATION,
      easing: "linear",
      fill: "forwards",
    });
    animation.finished.then(finish).catch(finish);
    window.setTimeout(finish, FLY_DURATION + 250);
  } catch {
    finish();
  }
}

type FlyToCartContextValue = { fly: (opts: FlyOptions) => void };

const FlyToCartContext = createContext<FlyToCartContextValue | null>(null);

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const { reduce } = useMotionSafe();
  const [flight, setFlight] = useState<Flight | null>(null);

  const fly = useCallback(
    (opts: FlyOptions) => {
      const target = getCartTarget();
      if (reduce || !target || !opts.fromEl?.isConnected) {
        opts.onDone();
        return;
      }
      setFlight({
        key: Date.now(),
        from: centerOf(opts.fromEl),
        to: centerOf(target),
        src: opts.src,
        alt: opts.alt,
        children: opts.children,
        onDone: opts.onDone,
      });
    },
    [reduce]
  );

  const value = useMemo(() => ({ fly }), [fly]);

  return (
    <FlyToCartContext.Provider value={value}>
      {children}
      {flight && <FlyThumb flight={flight} onFinished={() => setFlight(null)} />}
    </FlyToCartContext.Provider>
  );
}

function FlyThumb({ flight, onFinished }: { flight: Flight; onFinished: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    runFlight(el, flight.from, flight.to, () => {
      bumpCartIcon();
      flight.onDone();
      onFinished();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.key]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none z-[60] overflow-hidden rounded-full border-2 border-white bg-white shadow-lg shadow-black/20"
      style={{
        position: "fixed",
        width: FLY_SIZE,
        height: FLY_SIZE,
        left: flight.from.x - FLY_SIZE / 2,
        top: flight.from.y - FLY_SIZE / 2,
      }}
    >
      {flight.src ? (
        <BlurImage
          src={flight.src}
          alt={flight.alt ?? ""}
          fill
          sizes={`${FLY_SIZE}px`}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-cta-soft text-[var(--brand)]">
          {flight.children}
        </div>
      )}
    </div>
  );
}

export function useFlyToCart(): (opts: FlyOptions) => void {
  const ctx = useContext(FlyToCartContext);
  if (!ctx) {
    throw new Error("useFlyToCart must be used within <FlyToCartProvider>");
  }
  return ctx.fly;
}