/**
 * Fulfilment (how the customer receives the order) availability.
 *
 * Two ways to get the water: `delivery` (a rider brings it to the door) and
 * `pickup` (collect it from the station, no delivery fee).
 *
 * Pickup is switched off for now because the order pipeline has no pickup
 * path behind it:
 *
 * - `validateOrder` (src/lib/server/order-store.ts) requires a delivery
 *   address on every order, and the location modal skips address collection
 *   for pickup, so a pickup order could never be completed.
 * - The same validator recomputes the delivery fee from the station's own
 *   rule and rejects any other figure, so "no delivery fee" could never be
 *   charged for a pickup order.
 *
 * Offering it before that exists would let a customer pick "Pickup", pick up
 * a checkout that demands an address they were never asked for, and still be
 * charged delivery.
 *
 * To turn pickup on, the server has to learn the fulfilment method first:
 * accept `fulfilment` on the order payload, charge no delivery fee for
 * pickup, and require an address only for delivery.
 */
export const PICKUP_ENABLED = false;
