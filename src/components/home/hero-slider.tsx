"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { markLoaded } from "@/lib/load-progress";
import { HERO_WASH, type HeroSlide } from "@/config/hero-slides";

const SLIDE_DURATION = 500;
const SLIDE_EASE = "cubic-bezier(0,0,0.2,1)";
const SWIPE_THRESHOLD = 50;

interface HeroSliderProps {
  slides: HeroSlide[];
  interval?: number;
}

export function HeroSlider({ slides, interval = 7000 }: HeroSliderProps) {
  const reduce = usePrefersReducedMotion();
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

  const indexRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startIndexRef = useRef(0);
  const lastXRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      const target = ((next % count) + count) % count;
      if (target === indexRef.current) return;
      setIndex(target);
    },
    [count]
  );

  useEffect(() => {
    if (reduce || paused || hidden || dragging || count < 2) return;
    const timer = setTimeout(() => goTo(indexRef.current + 1), interval);
    return () => clearTimeout(timer);
  }, [reduce, paused, hidden, dragging, count, interval, goTo, index]);

  useEffect(() => {
    const onVisibilityChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(indexRef.current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(indexRef.current + 1);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setDragging(true);
    setPaused(true);
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    startIndexRef.current = indexRef.current;
    trackRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    lastXRef.current = e.clientX;
    const delta = e.clientX - startXRef.current;
    setDragX(delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    setDragX(0);
    trackRef.current?.releasePointerCapture(e.pointerId);
    const delta = lastXRef.current - startXRef.current;
    if (delta < -SWIPE_THRESHOLD) goTo(startIndexRef.current + 1);
    else if (delta > SWIPE_THRESHOLD) goTo(startIndexRef.current - 1);
    window.setTimeout(() => setPaused(false), 150);
  };

  const activeSlide = slides[index];
  const slideWidth = 100 / count;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured water delivery highlights"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0">
        <div
          ref={trackRef}
          className="flex h-full cursor-grab active:cursor-grabbing select-none touch-pan-y"
          style={{
            width: `${count * 100}%`,
            transform: `translateX(calc(-${index * slideWidth}% + ${dragX}px))`,
            transition: dragging ? "none" : reduce ? "none" : `transform ${SLIDE_DURATION}ms ${SLIDE_EASE}`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="relative h-full"
              style={{ width: `${slideWidth}%` }}
              aria-hidden={i === index ? undefined : true}
            >
              <Image
                src={slide.image}
                alt={i === index ? slide.alt : ""}
                fill
                sizes="100vw"
                className="object-cover"
                preload={i === 0}
                draggable={false}
                onLoad={() => {
                  if (i === 0) markLoaded("hero");
                }}
              />
              <div className="absolute inset-0" style={{ background: HERO_WASH }} />
              {i === index && <SlideCopy slide={slide} />}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-5 top-4 z-20 flex items-center gap-3 lg:bottom-10 lg:right-12 lg:top-auto">
        <div className="hidden items-center gap-1.5 lg:flex">
          <ArrowButton label="Previous slide" onClick={() => goTo(indexRef.current - 1)}>
            <ChevronLeft className="size-5" aria-hidden />
          </ArrowButton>
          <ArrowButton label="Next slide" onClick={() => goTo(indexRef.current + 1)}>
            <ChevronRight className="size-5" aria-hidden />
          </ArrowButton>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Choose a slide">
          {slides.map((slide, i) => {
            const active = i === index;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1} of ${count}: ${slide.headline}`}
                aria-current={active ? "true" : undefined}
                className="flex h-8 items-center rounded-full px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aqua)]"
              >
                <span
                  className="block h-2 rounded-full bg-white transition-all duration-300"
                  style={{ width: active ? 22 : 8, opacity: active ? 1 : 0.45 }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`Slide ${index + 1} of ${count}: ${activeSlide.headline}`}
      </p>
    </div>
  );
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aqua)]"
    >
      {children}
    </button>
  );
}

function SlideCopy({ slide }: { slide: HeroSlide }) {
  return (
    <div className="absolute inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] mx-auto w-full max-w-[34rem] px-5 sm:px-8 lg:inset-y-0 lg:bottom-auto lg:left-auto lg:right-12 lg:mx-0 lg:top-1/2 lg:w-[21rem] lg:max-w-none lg:-translate-y-1/2 lg:px-0 xl:w-[25rem]">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 lg:-bottom-10"
          style={{
            background:
              "radial-gradient(130% 160% at 50% 50%, rgba(2,18,40,0.93) 0%, rgba(2,18,40,0.88) 40%, rgba(2,18,40,0.62) 72%, rgba(2,18,40,0) 100%)",
          }}
        />
        <div className="relative py-4 text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[var(--aqua)]" aria-hidden />
            {slide.eyebrow}
          </span>
          <p className="mt-3 font-display text-xl font-semibold leading-[1.2] tracking-tight text-white sm:text-2xl lg:text-[1.7rem]">
            {slide.headline}
          </p>
          <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-white/85">
            {slide.body}
          </p>
        </div>
      </div>
    </div>
  );
}
