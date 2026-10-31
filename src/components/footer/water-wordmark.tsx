"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const W = 1440;
const H = 340;
const WL_START = 330;
const WL_END = 180;

function waveLine(level: number, amplitude: number, wavelength: number, width: number) {
  let d = `M 0 ${level}`;
  const quarter = wavelength / 4;

  for (let x = 0; x < width; x += wavelength) {
    for (let part = 0; part < 4; part += 1) {
      const startAngle = (part * Math.PI) / 2;
      const endAngle = ((part + 1) * Math.PI) / 2;
      const startY = level + amplitude * Math.sin(startAngle);
      const endY = level + amplitude * Math.sin(endAngle);
      const startSlope = amplitude * ((2 * Math.PI) / wavelength) * Math.cos(startAngle);
      const endSlope = amplitude * ((2 * Math.PI) / wavelength) * Math.cos(endAngle);
      const x0 = x + part * quarter;
      const control1Y = startY + (startSlope * quarter) / 3;
      const control2Y = endY - (endSlope * quarter) / 3;

      d += ` C ${x0 + quarter / 3} ${control1Y} ${x0 + (2 * quarter) / 3} ${control2Y} ${x0 + quarter} ${endY}`;
    }
  }

  return d;
}

function waveBody(level: number, amplitude: number, wavelength: number, width: number) {
  return `${waveLine(level, amplitude, wavelength, width)} V ${H + 40} H 0 Z`;
}

export function WaterWordmark() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const startedRef = useRef(false);
  const [level, setLevel] = useState(WL_START);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      const id = requestAnimationFrame(() => setLevel(WL_END));
      svg.pauseAnimations();
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          svg.unpauseAnimations();
          if (startedRef.current) return;

          startedRef.current = true;
          const start = performance.now();
          const duration = 2200;
          const rise = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - (1 - progress) ** 3;
            setLevel(WL_START + (WL_END - WL_START) * eased);
            if (progress < 1) frame = requestAnimationFrame(rise);
          };

          frame = requestAnimationFrame(rise);
        } else {
          svg.pauseAnimations();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(svg);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const main = useMemo(() => waveBody(level, 16, 720, W * 2 + 720), [level]);
  const back = useMemo(() => waveBody(level + 12, 10, 480, W * 2 + 480), [level]);
  const crest = useMemo(() => waveLine(level, 16, 720, W * 2 + 720), [level]);
  const crest2 = useMemo(() => waveLine(level + 12, 10, 480, W * 2 + 480), [level]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="MajiFlow, clean water"
      className="mf-wordmark-svg select-none"
    >
      <defs>
        <linearGradient
          id="mfSilver"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2={H}
        >
          <stop offset="0" stopColor="#334155" />
          <stop offset="0.34" stopColor="#64748b" />
          <stop offset="0.39" stopColor="#94a3b8" />
          <stop offset="0.44" stopColor="#e2e8f0" />
          <stop offset="0.48" stopColor="#ffffff" />
          <stop offset="0.54" stopColor="#cbd5e1" />
          <stop offset="0.61" stopColor="#f8fafc" />
          <stop offset="0.68" stopColor="#94a3b8" />
          <stop offset="0.75" stopColor="#e2e8f0" />
          <stop offset="0.82" stopColor="#ffffff" />
          <stop offset="0.9" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="mfDeep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#159bad" stopOpacity=".48" />
          <stop offset="1" stopColor="#06265e" stopOpacity=".94" />
        </linearGradient>
        <filter id="mfRefract" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.03" numOctaves="2" seed="3" result="ripple">
            <animate
              attributeName="baseFrequency"
              dur="14s"
              values="0.008 0.03;0.014 0.045;0.008 0.03"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="ripple"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation="1" />
        </filter>
        <mask id="mfAbove" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="#fff" />
          <path d={main} fill="#000">
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-720 0"
              dur="9s"
              repeatCount="indefinite"
            />
          </path>
        </mask>
        <clipPath id="mfBelow" clipPathUnits="userSpaceOnUse">
          <path d={main}>
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-720 0"
              dur="9s"
              repeatCount="indefinite"
            />
          </path>
        </clipPath>
      </defs>

      <path d={main} fill="url(#mfDeep)">
        <animateTransform
          attributeName="transform"
          type="translate"
          from="0 0"
          to="-720 0"
          dur="9s"
          repeatCount="indefinite"
        />
      </path>
      <path d={back} fill="rgba(124, 200, 255, .14)">
        <animateTransform
          attributeName="transform"
          type="translate"
          from="-480 0"
          to="0 0"
          dur="7s"
          repeatCount="indefinite"
        />
      </path>

      <g clipPath="url(#mfBelow)" filter="url(#mfRefract)">
        <text
          x={160}
          y={280}
          fontSize={220}
          textLength={1120}
          lengthAdjust="spacingAndGlyphs"
          className="mf-wordmark"
          fill="url(#mfSilver)"
          opacity=".5"
        >
          MajiFlow
        </text>
        <text
          x={860}
          y={320}
          fontSize={70}
          textLength={340}
          lengthAdjust="spacingAndGlyphs"
          className="mf-script"
          fill="#a5e4f5"
          opacity=".76"
        >
          clean water
        </text>
      </g>

      <text
        x={160}
        y={280}
        fontSize={220}
        textLength={1120}
        lengthAdjust="spacingAndGlyphs"
        className="mf-wordmark"
        fill="url(#mfSilver)"
        stroke="#0f172a"
        strokeOpacity=".2"
        strokeWidth={2}
        paintOrder="stroke"
        mask="url(#mfAbove)"
      >
        MajiFlow
      </text>

      <path d={crest2} fill="none" stroke="#9ad8ff" strokeOpacity=".55" strokeWidth={2}>
        <animateTransform
          attributeName="transform"
          type="translate"
          from="-480 0"
          to="0 0"
          dur="7s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d={crest}
        fill="none"
        stroke="#e6f6ff"
        strokeOpacity=".96"
        strokeWidth={3}
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          from="0 0"
          to="-720 0"
          dur="9s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

export default WaterWordmark;
