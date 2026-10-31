/**
 * Every asset path, timing and copy string the loading system needs.
 *
 * To use your own footage, drop the files into `public/loader/` and point the
 * three paths below at them. Nothing else has to change.
 */
export const LOADER_ASSETS = {
  /** WebM first: smaller and better supported in Chromium. */
  videoWebm: "/loader/water-loop.webm",
  /** MP4 fallback for Safari and older iOS. */
  videoMp4: "/loader/water-loop.mp4",
  /** Blurred first frame, painted instantly while the video loads. */
  poster: "/loader/poster.jpg",
} as const;

export const LOADER_TIMINGS = {
  /** The splash never flashes: it stays up at least this long. */
  minDisplayMs: 700,
  /** Hard cap, so a slow network can never trap the user behind the splash. */
  maxDisplayMs: 3000,
  /** Splash exit: fade out plus a slight scale up. */
  exitMs: 500,
  /** If the video has not played by now we switch to the minimal fallback. */
  videoTimeoutMs: 1500,
  /** Logo fade + gentle scale in. */
  logoInMs: 600,
  /** Tagline fade in, shortly after the logo. */
  taglineInMs: 600,
  /** One full breath of the logo glow. */
  breatheMs: 3600,
  /** Progress line easing towards its next value. */
  progressEaseMs: 450,
} as const;

export const SPLASH_COPY = {
  tagline: "Fresh water, at your door",
  /** Screen-reader status while the splash is up. */
  status: "Loading MajiFlow",
} as const;

/** Dark navy to aqua wash over the footage, so the type stays readable. */
export const SPLASH_OVERLAY = {
  opacity: 0.55,
  gradient:
    "linear-gradient(178deg, rgba(4,18,44,0.88) 0%, rgba(5,32,74,0.66) 42%, rgba(0,74,140,0.58) 74%, rgba(0,194,214,0.52) 100%)",
} as const;

/** Minimal fallback: brand gradient, no footage. */
export const SPLASH_FALLBACK_BACKGROUND =
  "radial-gradient(120% 90% at 50% 12%, #0b2a5c 0%, #04122c 46%, #02102a 100%)";

/** sessionStorage key that keeps the splash to once per session. */
export const SPLASH_SESSION_KEY = "majiflow:splash-seen";

/** Connection and device thresholds that switch the splash to the fallback. */
export const LOADER_FALLBACK_RULES = {
  /** `navigator.connection.effectiveType` values that count as slow. */
  slowEffectiveTypes: ["slow-2g", "2g", "3g"] as const,
  /** Fewer than this many logical cores counts as a low-end device. */
  minCpuCores: 5,
  /** Less than this much RAM (GB) counts as a low-end device. */
  minDeviceMemoryGb: 5,
} as const;

/** Top-of-screen route progress bar. */
export const ROUTE_PROGRESS = {
  heightPx: 3,
  /** The bar creeps to this point, then slides to the end. */
  settleMs: 320,
  /** How long the completed bar stays visible before fading. */
  holdMs: 180,
  fadeMs: 260,
} as const;
