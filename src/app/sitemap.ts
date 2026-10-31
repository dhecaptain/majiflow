import type { MetadataRoute } from "next";
import { listStations } from "@/lib/server/catalog";
import { SITE_URL } from "@/lib/constants";

// Station URLs depend on live subscription eligibility, so the sitemap must
// re-run the same authoritative gate instead of being cached at build time.
export const dynamic = "force-dynamic";

const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/browse", priority: 0.9, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.7, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "weekly" },
  { path: "/for-business", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.6, changeFrequency: "monthly" },
  { path: "/business/register", priority: 0.7, changeFrequency: "monthly" },
  { path: "/register", priority: 0.5, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const pages = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // A sitemap without station pages is still a valid sitemap.
  const catalog = await listStations().catch(() => []);
  const stations = catalog.map(({ slug }) => ({
    url: `${SITE_URL}/browse/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...pages, ...stations];
}
