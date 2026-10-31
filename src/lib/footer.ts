const MARKETING_PATHS = [
  "/",
  "/about",
  "/how-it-works",
  "/pricing",
  "/faqs",
  "/contact",
  "/for-business",
  "/privacy",
  "/terms",
] as const;

/**
 * The footer is marketing chrome, not part of the ordering app. Keep it off
 * the browse/cart/checkout/tracking flow and the signed-in shells so it never
 * sits under a fixed action bar.
 */
export function shouldShowFooter(pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  return MARKETING_PATHS.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)
  );
}
