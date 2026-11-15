import { Hero } from "@/components/home/hero";
import { BrowseCategories } from "@/components/home/browse-categories";
import { NearbyStations, SendWaterCard } from "@/components/home/nearby-stations";
import { HowItWorks, VendorBanner } from "@/components/home/vendor-banner";

export const metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrowseCategories />
      <NearbyStations />
      <SendWaterCard />
      <HowItWorks />
      <VendorBanner />
    </>
  );
}
