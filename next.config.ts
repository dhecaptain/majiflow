import type { NextConfig } from "next";

/**
 * Security headers for every response. The CSP allows inline scripts and
 * styles (the splash gate, JSON-LD and motion styles are inline) and the two
 * map tile hosts; everything else must come from this site.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "10.162.122.91"],
  // Pin the Turbopack root so it does not scan parent directories, which
  // makes the first dev compile much faster.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Speeds up compiling the large icon barrel imports.
    optimizePackageImports: ["lucide-react"],
  },
  compress: true,
  poweredByHeader: false,
  async headers() {
    // Development tooling (HMR, React refresh) needs eval and websockets, so
    // the CSP is only enforced on production builds.
    const csp = process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : [];
    return [{ source: "/:path*", headers: [...securityHeaders, ...csp] }];
  },
};

export default nextConfig;
