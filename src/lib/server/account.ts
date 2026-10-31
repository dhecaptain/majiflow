import { and, desc, eq, ne } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { customerAddresses, customerPreferences, users } from "@/lib/server/db/schema";
import { addressKey, mergeAddressInput, type AddressInput, type PreferencesInput, type ProfileInput } from "@/lib/server/account-validation";
import { detachCustomerOrders } from "@/lib/server/order-store";
import type { CustomerAccountProfile, CustomerPreferences, SavedAddress } from "@/lib/account";

/**
 * Customer-account persistence. Every read and write is scoped by the
 * session user's id, so a guessed address id from another account behaves
 * exactly like one that doesn't exist.
 */

export const MAX_SAVED_ADDRESSES = 10;

export type { CustomerAccountProfile, CustomerPreferences, SavedAddress };

export class AccountConflictError extends Error {
  constructor(message: string, readonly field = "_form") {
    super(message);
  }
}

type AddressRow = typeof customerAddresses.$inferSelect;


const DEFAULT_PREFERENCES: CustomerPreferences = {
  orderUpdates: true,
  marketing: false,
  notificationsReadAt: null,
  fulfilment: null,
  lastStationId: null,
};

export function toSavedAddress(row: AddressRow): SavedAddress {
  return {
    id: row.id,
    isDefault: row.isDefault,
    label: row.label,
    estate: row.estate,
    street: row.street ?? undefined,
    building: row.building ?? undefined,
    floor: row.floor ?? undefined,
    city: row.city ?? undefined,
    landmark: row.landmark ?? undefined,
    notes: row.notes ?? undefined,
    phone: row.phone,
    lat: row.latitude ?? undefined,
    lng: row.longitude ?? undefined,
    accuracy: row.accuracy ?? undefined,
    locationAt: row.locationAt?.toISOString(),
  };
}

function columns(input: AddressInput) {
  return {
    label: input.label,
    estate: input.estate,
    street: input.street,
    building: input.building,
    floor: input.floor,
    city: input.city,
    landmark: input.landmark,
    notes: input.notes,
    phone: input.phone,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    locationAt: input.locationAt,
  };
}

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  const { db } = await getDatabase();
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, userId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
  return rows.map(toSavedAddress);
}

/**
 * Save an address, merging into an existing entry for the same place rather
 * than duplicating it (checkout re-saves the address it just delivered to).
 */
export async function saveAddress(userId: string, input: AddressInput): Promise<SavedAddress> {
  const { db } = await getDatabase();
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(customerAddresses).where(eq(customerAddresses.userId, userId));
    const match = existing.find((row) => addressKey(row) === addressKey(input));
    if (!match && existing.length >= MAX_SAVED_ADDRESSES) {
      throw new AccountConflictError(`You can save up to ${MAX_SAVED_ADDRESSES} addresses - remove one first.`);
    }
    const makeDefault = input.makeDefault || existing.length === 0 || !existing.some((row) => row.isDefault);
    if (makeDefault) {
      await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, userId));
    }
    const now = new Date();
    const [row] = match
      ? await tx
          .update(customerAddresses)
          .set({ ...mergeAddressInput(match, input), isDefault: makeDefault || match.isDefault, updatedAt: now })
          .where(and(eq(customerAddresses.id, match.id), eq(customerAddresses.userId, userId)))
          .returning()
      : await tx
          .insert(customerAddresses)
          .values({ ...columns(input), userId, isDefault: makeDefault })
          .returning();
    return toSavedAddress(row);
  });
}

export async function updateAddress(userId: string, id: string, input: AddressInput): Promise<SavedAddress | null> {
  const { db } = await getDatabase();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .limit(1);
    if (!current) return null;
    const others = await tx
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.userId, userId), ne(customerAddresses.id, id)));
    if (others.some((row) => addressKey(row) === addressKey(input))) {
      throw new AccountConflictError("You already saved this address.", "estate");
    }
    if (input.makeDefault) {
      await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, userId));
    }
    const [row] = await tx
      .update(customerAddresses)
      .set({ ...columns(input), isDefault: input.makeDefault || current.isDefault, updatedAt: new Date() })
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .returning();
    return toSavedAddress(row);
  });
}

export async function setDefaultAddress(userId: string, id: string): Promise<SavedAddress | null> {
  const { db } = await getDatabase();
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .limit(1);
    if (!owned) return null;
    await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, userId));
    const [row] = await tx
      .update(customerAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .returning();
    return toSavedAddress(row);
  });
}

/** Remove an address; if it was the default, the most recently used one takes over. */
export async function deleteAddress(userId: string, id: string): Promise<boolean> {
  const { db } = await getDatabase();
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId)))
      .returning();
    if (!removed) return false;
    if (removed.isDefault) {
      const [next] = await tx
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(eq(customerAddresses.userId, userId))
        .orderBy(desc(customerAddresses.updatedAt))
        .limit(1);
      if (next) {
        await tx.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, next.id));
      }
    }
    return true;
  });
}

export async function getProfile(userId: string): Promise<CustomerAccountProfile | null> {
  const { db } = await getDatabase();
  const [user] = await db
    .select({ name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? { name: user.name, email: user.email ?? "", phone: user.phone ?? "" } : null;
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<CustomerAccountProfile | null> {
  const { db } = await getDatabase();
  const values: { name: string; phone: string | null; email?: string; updatedAt: Date } = {
    name: input.name,
    phone: input.phone,
    updatedAt: new Date(),
  };
  if (input.email) {
    // Phone-first customers have no email yet, so they may add one. Once an
    // email is set it is the sign-in identity and stays fixed.
    const [current] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (current?.email) {
      throw new AccountConflictError("Your email is your sign-in and can't be changed here.", "email");
    }
    values.email = input.email;
  }
  const [user] = await db
    .update(users)
    .set(values)
    .where(eq(users.id, userId))
    .returning({ name: users.name, email: users.email, phone: users.phone });
  return user ? { name: user.name, email: user.email ?? "", phone: user.phone ?? "" } : null;
}

export async function getPreferences(userId: string): Promise<CustomerPreferences> {
  const { db } = await getDatabase();
  const [row] = await db.select().from(customerPreferences).where(eq(customerPreferences.userId, userId)).limit(1);
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    orderUpdates: row.orderUpdates,
    marketing: row.marketing,
    notificationsReadAt: row.notificationsReadAt?.toISOString() ?? null,
    fulfilment: row.fulfilment === "delivery" || row.fulfilment === "pickup" ? row.fulfilment : null,
    lastStationId: row.lastStationId ?? null,
  };
}

async function upsertPreferences(
  userId: string,
  values: Partial<{
    orderUpdates: boolean;
    marketing: boolean;
    notificationsReadAt: Date;
    fulfilment: string | null;
    lastStationId: string | null;
  }>
): Promise<CustomerPreferences> {
  const { db } = await getDatabase();
  const updatedAt = new Date();
  const [row] = await db
    .insert(customerPreferences)
    .values({ userId, ...values, updatedAt })
    .onConflictDoUpdate({ target: customerPreferences.userId, set: { ...values, updatedAt } })
    .returning();
  return {
    orderUpdates: row.orderUpdates,
    marketing: row.marketing,
    notificationsReadAt: row.notificationsReadAt?.toISOString() ?? null,
    fulfilment: row.fulfilment === "delivery" || row.fulfilment === "pickup" ? row.fulfilment : null,
    lastStationId: row.lastStationId ?? null,
  };
}

export function updatePreferences(userId: string, input: PreferencesInput) {
  return upsertPreferences(userId, input);
}

export function markNotificationsRead(userId: string, at = new Date()) {
  return upsertPreferences(userId, { notificationsReadAt: at });
}

/**
 * Whether a customer still wants order status messages. Defaults to yes when
 * the preference can't be read, so a database blip never silences updates.
 */
export async function wantsOrderUpdates(userId: string | undefined): Promise<boolean> {
  if (!userId) return true;
  try {
    return (await getPreferences(userId)).orderUpdates;
  } catch {
    return true;
  }
}

/** Delete the user (cascading sessions, addresses, preferences) and unlink their orders. */
export async function deleteCustomerAccount(userId: string): Promise<void> {
  const { db } = await getDatabase();
  await db.delete(users).where(and(eq(users.id, userId), eq(users.role, "customer")));
  await detachCustomerOrders(userId);
}
