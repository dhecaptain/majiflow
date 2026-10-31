import { Hero } from "@/components/home/hero";
import { BrowseCategories } from "@/components/home/browse-categories";
import { GiftBanner } from "@/components/home/gift-banner";
import { AppDownload } from "@/components/home/app-download";
import { VendorBanner } from "@/components/home/vendor-banner";

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrowseCategories />
      <GiftBanner />
      <AppDownload />
      <VendorBanner />
    </>
  );
}
