/**
 * Cart pricing, shared by the cart and checkout screens.
 *
 * A cart holds one station, and that station charges the delivery: it applies
 * its free-delivery threshold to the subtotal of the items coming from it. The
 * fee is computed here so the number shown in the cart is the number the order
 * is created with at checkout. Refundable deposits are tracked separately and
 * added to the total, so a container deposit is never hidden in the item price.
 */

export interface CartLineLike {
  businessId: string;
  quantity: number;
  unitPrice: number;
  /** Refundable deposit per unit (can swaps, container hire). */
  deposit?: number;
}

export interface StationFeeInfo {
  id: string;
  deliveryFee: number;
  freeDeliveryAbove: number;
}

export interface StationGroup {
  businessId: string;
  subtotal: number;
  deliveryFee: number;
  /** Refundable deposits collected for this station's lines. */
  deposit: number;
  total: number;
}

export interface CartTotals {
  subtotal: number;
  deliveryFee: number;
  /** Refundable deposits collected with the order. */
  deposit: number;
  total: number;
  /** Per-station breakdown, in the order the stations first appear. */
  groups: StationGroup[];
}

/** Money is compared to the cent, so totals do not drift on floats. */
const rands = (value: number) => Math.round(value * 100) / 100;

export function lineSubtotal(unitPrice: number, quantity: number): number {
  return rands(unitPrice * quantity);
}

/** Refundable deposit collected for a line. */
export function lineDeposit(depositPerUnit: number, quantity: number): number {
  if (!Number.isFinite(depositPerUnit) || depositPerUnit <= 0) return 0;
  return rands(depositPerUnit * quantity);
}

/**
 * Fee for one station's own subtotal. Free once the subtotal reaches the
 * station's threshold; an empty group is never charged.
 */
export function deliveryFeeForStation(
  stationSubtotal: number,
  station: Pick<StationFeeInfo, "deliveryFee" | "freeDeliveryAbove">
): number {
  if (stationSubtotal <= 0) return 0;
  return stationSubtotal >= station.freeDeliveryAbove ? 0 : station.deliveryFee;
}

export function computeCartTotals(
  lines: CartLineLike[],
  stations: readonly StationFeeInfo[]
): CartTotals {
  const stationById = new Map(stations.map((station) => [station.id, station]));

  const byStation = new Map<string, { subtotal: number; deposit: number }>();
  for (const line of lines) {
    const running = byStation.get(line.businessId) ?? { subtotal: 0, deposit: 0 };
    byStation.set(line.businessId, {
      subtotal: rands(running.subtotal + lineSubtotal(line.unitPrice, line.quantity)),
      deposit: rands(running.deposit + lineDeposit(line.deposit ?? 0, line.quantity)),
    });
  }

  const groups: StationGroup[] = [];
  let subtotal = 0;
  let deliveryFee = 0;
  let deposit = 0;

  for (const [businessId, group] of byStation) {
    const station = stationById.get(businessId);
    const fee = station ? deliveryFeeForStation(group.subtotal, station) : 0;
    groups.push({
      businessId,
      subtotal: group.subtotal,
      deliveryFee: fee,
      deposit: group.deposit,
      total: rands(group.subtotal + fee + group.deposit),
    });
    subtotal = rands(subtotal + group.subtotal);
    deliveryFee = rands(deliveryFee + fee);
    deposit = rands(deposit + group.deposit);
  }

  return { subtotal, deliveryFee, deposit, total: rands(subtotal + deliveryFee + deposit), groups };
}
