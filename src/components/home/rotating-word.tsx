"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RotatingWordProps {
  words: readonly string[];
  className?: string;
  interval?: number;
}

/**
 * Cycles through words with a soft, water-like vertical fade. A hidden sizer
 * holds the width of the longest word so the surrounding headline never
 * reflows as the word changes.
 */
export function RotatingWord({ words, className, interval = 2400 }: RotatingWordProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || words.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [reduce, words.length, interval]);

  const first = words[0] ?? "";
  if (reduce || words.length < 2) {
    return <span className={className}>{first}</span>;
  }

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), first);
  const word = words[index] ?? first;

  return (
    <span className="relative inline-grid align-baseline">
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {longest}
      </span>
      <span className="col-start-1 row-start-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={word}
            initial={{ y: "0.45em", opacity: 0, filter: "blur(6px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: "-0.45em", opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn("inline-block whitespace-nowrap", className)}
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
