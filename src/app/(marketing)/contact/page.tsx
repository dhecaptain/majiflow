import type { Metadata } from "next";
import { ContactPage } from "@/components/marketing/contact-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about an order, listing your refill station or billing? Send MajiFlow a message.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return <ContactPage />;
}
