import { SiteHeader } from "@/components/layout/site-header";
import { PageTransition } from "@/components/layout/page-transition";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
