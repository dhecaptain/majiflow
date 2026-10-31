import { ContentPage, ProseList, ProseSection } from "@/components/shared/content-page";
import { LEGAL_UPDATED } from "@/lib/constants";

export const metadata = {
  title: "Privacy Policy",
  description: "How MajiFlow collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <ContentPage
      label="Legal"
      title="Privacy Policy"
      description="How MajiFlow collects, uses, and protects your personal information."
      updated={LEGAL_UPDATED}
    >
      <ProseSection title="Privacy Policy">
        <p>
          MajiFlow collects only the information we need to run your orders and your account. This
          policy explains what we store, how we use it and the choices you have.
        </p>
      </ProseSection>

      <ProseSection title="What we store">
        <ProseList
          items={[
            "Orders you place - the items, quantities, station, totals and delivery fee, written to the order store",
            "Status history - each change an order goes through, so the tracking page can show it",
            "Account details - your name, phone number and delivery addresses",
            "Local browser state - your cart and the preferences you toggle, kept in localStorage on your device",
          ]}
        />
      </ProseSection>

      <ProseSection title="How we use it">
        <ProseList
          items={[
            "To take, route and deliver your orders and keep you updated on their status",
            "To let stations manage the orders they receive and support you if something goes wrong",
            "To improve the platform and understand how it is used, in aggregate",
          ]}
        />
      </ProseSection>

      <ProseSection title="What we do not do">
        <ProseList
          items={[
            "We do not sell your personal information to third parties",
            "We do not store card numbers - payments are handled by our payment providers",
            "We do not send marketing messages without your consent",
          ]}
        />
      </ProseSection>

      <ProseSection title="Clearing your data">
        <p>
          You can request a copy of your data or ask us to delete it by contacting support. Clearing
          your browser&apos;s site data removes the cart and preferences held in localStorage on your
          device.
        </p>
      </ProseSection>

      <ProseSection title="Your rights">
        <p>
          You have the right to access, correct and delete your personal information, and to object
          to certain processing, under the Kenya Data Protection Act, 2019. Contact us to exercise
          any of these rights.
        </p>
      </ProseSection>
    </ContentPage>
  );
}
