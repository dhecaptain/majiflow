import { BrowseSiteHeader } from "@/components/layout/site-header";

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BrowseSiteHeader />
      {children}
    </>
  );
}
