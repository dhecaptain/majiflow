import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { AppSplash } from "@/components/layout/app-splash";
import { SITE_URL } from "@/lib/constants";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600"],
});





export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "MajiFlow",
  title: {
    default: "MajiFlow - Clean water, delivered simply",
    template: "%s · MajiFlow",
  },
  description:
    "Order clean, affordable drinking water from independent refill stations across Kenya. Compare prices, pay with M-Pesa, and track your delivery.",
  keywords: [
    "water delivery Kenya",
    "refill water Nairobi",
    "M-Pesa water order",
    "drinking water delivery",
    "water refill stations",
    "MajiFlow",
  ],
  authors: [{ name: "MajiFlow" }],
  creator: "MajiFlow",
  publisher: "MajiFlow",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "MajiFlow",
    locale: "en_KE",
    url: "/",
    title: "MajiFlow - Clean water, delivered simply",
    description:
      "Order clean drinking water from refill stations near you. Compare prices, pay with M-Pesa, and track your delivery.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MajiFlow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MajiFlow - Clean water, delivered simply",
    description: "Order clean drinking water from refill stations near you.",
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0052FF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Entrance animations server-render at opacity:0. Without JS nothing ever
            reveals them, so force them visible to keep content readable. */}
        <noscript>
          <style>{`[style*="opacity:0"],.reveal,.stagger>*{opacity:1 !important;transform:none !important}.app-splash{display:none !important}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "MajiFlow",
                  url: SITE_URL,
                  logo: `${SITE_URL}/icon.png`,
                },
                {
                  "@type": "WebSite",
                  name: "MajiFlow",
                  url: SITE_URL,
                  potentialAction: {
                    "@type": "SearchAction",
                    target: `${SITE_URL}/browse?q={search_term_string}`,
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        <Providers>{children}</Providers>
        <PwaRegister />
        <AppSplash />
      </body>
    </html>
  );
}