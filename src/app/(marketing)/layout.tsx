import { SiteHeader } from "@/components/layout/site-header";
import { PageTransition } from "@/components/layout/page-transition";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
