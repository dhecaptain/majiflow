import type { DeliveryAddress, FulfillmentMethod } from "@/lib/types";

/**
 * What the header needs to know about the customer's order context: how they
 * want it, where it goes, and which station it is coming from. Pure so the
 * chip and the mobile pill always say the same thing.
 */

export interface OrderContextSession {
  fulfilment: FulfillmentMethod;
  address: DeliveryAddress | null;
}

export type OrderContextIcon = "delivery" | "pickup" | "send";

export interface HeaderOrderContext {
  icon: OrderContextIcon;
  /** One-line value shown in the header chip and the mobile order pill. */
  text: string;
}

function oneLine(address: DeliveryAddress | null | undefined): string {
  if (!address) return "";
  return [address.street, address.estate, address.city].filter(Boolean).join(", ") || address.label || "";
}

/** The full sentence a customer reads for their current delivery/pickup choice. */
export function orderSessionLabel(session: Pick<OrderContextSession, "fulfilment" | "address">): string {
  if (session.fulfilment === "pickup") return "Pickup from station";
  return oneLine(session.address) || "Set your delivery address";
}

export function summarizeOrderContext({
  session,
  stationName,
  sendWater,
}: {
  session: OrderContextSession;
  /** The station the cart belongs to, when it is a collection order. */
  stationName?: string | null;
  sendWater?: { recipient: { name: string }; address: DeliveryAddress } | null;
}): HeaderOrderContext {
  if (sendWater) {
    const where = oneLine(sendWater.address);
    const name = sendWater.recipient.name.trim() || "recipient";
    return {
      icon: "send",
      text: ["Send water", name, where].filter(Boolean).join(" · "),
    };
  }
  if (session.fulfilment === "pickup") {
    return {
      icon: "pickup",
      text: `Pickup · ${stationName?.trim() || "Choose a station"}`,
    };
  }
  return {
    icon: "delivery",
    text: `Delivery · ${oneLine(session.address) || "Set your address"}`,
  };
}

/**
 * The customer-facing routes that carry the delivery/pickup context. Account,
 * business and auth screens keep the plain header.
 */
export function isOrderingRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/browse" ||
    pathname.startsWith("/browse/") ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname.startsWith("/order/")
  );
}
