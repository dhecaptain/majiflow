import type { Faq } from "@/lib/types";

/**
 * Answers to the questions customers and station owners ask most.
 */
export const faqs: Faq[] = [
  {
    id: "f1",
    group: "customers",
    question: "How do I order water?",
    answer:
      "Choose your location, pick a refill station, add cans or bottles to your cart and continue to checkout. You see the delivery fee before you pay, and your order can be tracked from placed to delivered.",
  },
  {
    id: "f2",
    group: "customers",
    question: "What does delivery cost?",
    answer:
      "Each station sets its own delivery fee and free-delivery minimum, and both are shown on the station page and in your cart before you order. You order from one station at a time, so the fee and the minimum that apply are the ones shown for that station.",
  },
  {
    id: "f3",
    group: "customers",
    question: "Can I pay with M-Pesa?",
    answer:
      "Yes. You can pay with M-Pesa at checkout and receive a confirmation on your phone once the payment goes through. Card payment is available for stations that accept it.",
  },
  {
    id: "f4",
    group: "customers",
    question: "Can I schedule regular deliveries?",
    answer:
      "Recurring refill schedules are on our roadmap. For now each order is placed on its own, so you stay in control of when and how much you order.",
  },
  {
    id: "f5",
    group: "customers",
    question: "What if the water doesn't arrive?",
    answer:
      "Open the order from your account to see its status and contact the station directly. If you need more help, our support team is reachable from the contact page.",
  },
  {
    id: "f6",
    group: "businesses",
    question: "How do I register my refill business?",
    answer:
      "Use the business sign-up to add your station details, products, prices and delivery areas. Your storefront goes live on MajiFlow as soon as your profile is complete.",
  },
  {
    id: "f7",
    group: "businesses",
    question: "How do I get paid for orders?",
    answer:
      "Customer payments are collected at checkout and settled to your station account. Your dashboard shows every order, its payment state and the total for the period.",
  },
  {
    id: "f7b",
    group: "businesses",
    question: "Do I get my own dashboard and analytics?",
    answer:
      "Yes. Every station gets a dashboard with orders, analytics, customer lists and stock alerts, all built from the orders the station receives.",
  },
  {
    id: "f8",
    group: "businesses",
    question: "Can I cancel a subscription?",
    answer:
      "You can cancel at any time from your billing settings. Your station stays live until the end of the billing period, and you can export your data before you go.",
  },
  {
    id: "f9",
    group: "billing",
    question: "Is there a free trial?",
    answer:
      "Yes. Every plan starts with a 14-day free trial so you can run real orders before you pay anything.",
  },
  {
    id: "f10",
    group: "billing",
    question: "Are there setup or commission fees?",
    answer:
      "There are no setup fees and no commission. You pay a flat monthly subscription and keep the full price your customers pay for water.",
  },
];

export function faqsByGroup(group: Faq["group"]) {
  return faqs.filter((f) => f.group === group);
}
