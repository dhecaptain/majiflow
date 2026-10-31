import type {
  AccountEvent,
  AccountMetrics,
  CustomerAccountProfile,
  CustomerPreferences,
  OrderFilter,
  ReorderPlan,
  SavedAddress,
} from "@/lib/account";
import type { DeliveryAddress, FulfillmentMethod, Order } from "@/lib/types";

/**
 * Browser client for `/api/account/*`. Every call resolves to a result the
 * screen can branch on - data, or an error with per-field messages - so
 * failures surface as error states instead of misleading empty screens.
 */

export type AccountResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; fields: Record<string, string> };

const BASE = "/api/account";

async function request<T>(path: string, init?: RequestInit): Promise<AccountResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch {
    return { ok: false, status: 0, error: "You appear to be offline. Check your connection and try again.", fields: {} };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const detail = (body ?? {}) as { error?: string; fields?: Record<string, string> };
    return {
      ok: false,
      status: res.status,
      error:
        res.status === 401
          ? "Your session has ended. Sign in again to continue."
          : detail.error ?? "Something went wrong. Please try again.",
      fields: detail.fields ?? {},
    };
  }
  return { ok: true, data: body as T };
}

const json = (method: string, payload?: unknown): RequestInit => ({
  method,
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

export interface AccountSummary {
  metrics: AccountMetrics;
  activeOrders: Order[];
  recentOrders: Order[];
  addresses: SavedAddress[];
  addressCount: number;
  unreadNotifications: number;
}

export const accountApi = {
  summary: () => request<AccountSummary>("/summary"),
  orders: (filter: OrderFilter = "all") =>
    request<{ orders: Order[]; total: number }>(`/orders?filter=${filter}`),
  order: (id: string) =>
    request<{ order: Order; cancelBlockReason: string | null }>(`/orders/${encodeURIComponent(id)}`),
  reorder: (id: string) =>
    request<{ plan: ReorderPlan }>(`/orders/${encodeURIComponent(id)}/reorder`, json("POST")),
  cancelOrder: (id: string) =>
    request<{ order: Order }>(`/orders/${encodeURIComponent(id)}/cancel`, json("POST")),

  profile: () => request<{ profile: CustomerAccountProfile; addresses: SavedAddress[] }>("/profile"),
  updateProfile: (input: { name: string; phone: string }) =>
    request<{ profile: CustomerAccountProfile }>("/profile", json("PATCH", input)),

  addresses: () => request<{ addresses: SavedAddress[] }>("/addresses"),
  saveAddress: (input: Partial<DeliveryAddress> & { makeDefault?: boolean }) =>
    request<{ address: SavedAddress; addresses: SavedAddress[] }>("/addresses", json("POST", input)),
  updateAddress: (id: string, input: Partial<DeliveryAddress> & { makeDefault?: boolean }) =>
    request<{ address: SavedAddress; addresses: SavedAddress[] }>(
      `/addresses/${encodeURIComponent(id)}`,
      json("PATCH", input)
    ),
  makeDefaultAddress: (id: string) =>
    request<{ address: SavedAddress; addresses: SavedAddress[] }>(
      `/addresses/${encodeURIComponent(id)}`,
      json("PATCH", { makeDefault: true })
    ),
  deleteAddress: (id: string) =>
    request<{ addresses: SavedAddress[] }>(`/addresses/${encodeURIComponent(id)}`, json("DELETE")),

  notifications: () =>
    request<{ events: AccountEvent[]; unread: number; preferences: CustomerPreferences }>("/notifications"),
  updatePreferences: (input: Partial<Pick<CustomerPreferences, "orderUpdates" | "marketing">>) =>
    request<{ preferences: CustomerPreferences }>("/notifications", json("PATCH", input)),
  preferences: () => request<{ preferences: CustomerPreferences }>("/preferences"),
  updateOrderContext: (input: { fulfilment?: FulfillmentMethod; lastStationId?: string | null }) =>
    request<{ preferences: CustomerPreferences }>("/preferences", json("PATCH", input)),
  markNotificationsRead: () => request<{ preferences: CustomerPreferences }>("/notifications/read", json("POST")),

  deleteAccount: (password: string) => request<{ deleted: true }>("", json("DELETE", { password })),
};
