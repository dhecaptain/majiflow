import { ContentPage, ProseList, ProseSection } from "@/components/shared/content-page";
import { LEGAL_UPDATED } from "@/lib/constants";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for ordering water and listing a station on MajiFlow.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <ContentPage
      label="Legal"
      title="Terms of Service"
      description="Terms and conditions for using MajiFlow."
      updated={LEGAL_UPDATED}
    >
      <ProseSection title="Terms of Service">
        <p>
          Welcome to MajiFlow. By using our platform you agree to these terms. MajiFlow connects
          customers who want drinking water with independent refill businesses that sell and deliver
          it, so please read them carefully.
        </p>
      </ProseSection>

      <ProseSection title="1. Who is who">
        <p>
          MajiFlow connects customers who want drinking water with independent refill businesses that
          sell and deliver it. <strong>Each refill station is an independent supplier.</strong> Each
          refill business owns, filters and delivers its own water, sets its own prices, and is
          responsible for the quality and safety of its products.
        </p>
      </ProseSection>

      <ProseSection title="2. Using the platform">
        <p>You agree to use MajiFlow lawfully and not to misuse it, including by:</p>
        <ProseList
          items={[
            "Placing orders on behalf of others without their consent",
            "Posting false reviews or manipulating ratings on any business",
            "Impersonating customers, businesses, staff or platform staff",
            "Attempting to disrupt, scrape or reverse engineer the service",
          ]}
        />
      </ProseSection>

      <ProseSection title="3. Orders and payments">
        <p>
          You can build your cart and place an order, and the order is stored with a status you can
          follow. You pay the station when the order is handed over, by cash or M-Pesa; where M-Pesa
          checkout is offered you may pay up front instead. The station you ordered from fulfils the
          delivery.
        </p>
      </ProseSection>

      <ProseSection title="4. Business plans">
        <p>
          Stations subscribe to a monthly plan in KES. Every plan starts with a 14-day free trial,
          and MajiFlow charges no commission on the orders a station takes.
        </p>
      </ProseSection>

      <ProseSection title="5. Delivery">
        <p>
          Delivery fees and free-delivery minimums are set per station and added to the cart total
          before you pay. Each station is responsible for delivering the orders it accepts.
        </p>
      </ProseSection>

      <ProseSection title="6. Liability">
        <p>
          The independent station that supplies and delivers your water is responsible for its
          quality, safety and delivery. To the maximum extent permitted by law, MajiFlow is not
          liable for those matters. Nothing here limits liability that cannot lawfully be limited,
          including liability for fraud or personal injury caused by negligence.
        </p>
      </ProseSection>

      <ProseSection title="7. Changes">
        <p>
          We may update these terms from time to time. When we do, we publish the revised version on
          this page and update the date above.
        </p>
      </ProseSection>
    </ContentPage>
  );
}
