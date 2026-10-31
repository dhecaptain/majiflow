import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono, Pacifico, Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import { Footer } from "@/components/footer/site-footer";
import { PwaRegister } from "@/components/pwa-register";
import { SplashLoader } from "@/components/motion/splash-loader";
import { TopProgressBar } from "@/components/motion/top-progress-bar";
import { SPLASH_SESSION_KEY } from "@/config/loader";
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

const wordmark = Poppins({
  variable: "--font-wordmark",
  subsets: ["latin"],
  display: "swap",
  weight: "800",
  style: "italic",
});

const script = Pacifico({
  variable: "--font-script",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
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
  themeColor: "#0057E6",
};

/**
 * Runs before the first paint. On a repeat visit inside the same session the
 * splash is hidden outright, so the page appears straight away without the
 * splash flashing back on screen.
 */
const splashGateScript = `try{if(sessionStorage.getItem(${JSON.stringify(
  SPLASH_SESSION_KEY
)})==="1"){document.documentElement.setAttribute("data-splash","off")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${wordmark.variable} ${script.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: splashGateScript }} />
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
        <Footer />
        <PwaRegister />
        <TopProgressBar />
        <SplashLoader />
      </body>
    </html>
  );
}
