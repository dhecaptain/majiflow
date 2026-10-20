import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/lib/types";

/**
 * End-to-end fulfilment through the real route handlers and file stores:
 * verified payment -> station acceptance -> preparation -> rider link ->
 * delivery, plus rejection refunds, tenant isolation, notifications and
 * location consent. Only the session lookup and outbound messages are faked.
 */

type User = { id: string; name: string; email: string; role: "customer" | "business_owner" };

const session = vi.hoisted(() => ({ user: null as null | User }));
const owners = vi.hoisted(() => ({ map: {} as Record<string, string[]> }));
const sent = vi.hoisted(() => ({ messages: [] as { status: string; to: string; message?: string }[] }));
const prefs = vi.hoisted(() => ({ orderUpdates: true }));

vi.mock("@/lib/server/auth", () => {
  class AuthenticationError extends Error {}
  return {
    AuthenticationError,
    getCurrentUser: async () => session.user,
    getOptionalCustomer: async () => (session.user?.role === "customer" ? session.user : null),
  };
});

vi.mock("@/lib/server/stations", () => ({
  listOwnerStationIds: async (userId: string) => owners.map[userId] ?? [],
}));

vi.mock("@/lib/server/account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/account")>()),
  wantsOrderUpdates: async (userId: string | undefined) => (userId ? prefs.orderUpdates : true),
}));

vi.mock("@/lib/monitoring", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/monitoring")>()),
  reportFailure: async () => undefined,
  notifyStatusChange: async (order: { status: string }, to: string, message?: string) => {
    sent.messages.push({ status: order.status, to, message });
    return { sent: true };
  },
}));

const { GET: listRoute, POST: createRoute } = await import("@/app/api/orders/route");
const { GET: getRoute, PATCH } = await import("@/app/api/orders/[id]/route");
const { GET: locationGet, POST: locationPost } = await import("@/app/api/orders/[id]/location/route");
const { POST: consentRoute } = await import("@/app/api/orders/[id]/consent/route");
const { GET: riderGet, POST: riderPost } = await import("@/app/api/rider/[token]/route");
const { applyProviderOutcome, confirmRefund, getPayment, initiatePayment } = await import("@/lib/server/payments");
const { createOrder: seedOrder } = await import("@/lib/server/order-store");
const { ADMIN_COOKIE, issueAdminToken } = await import("@/lib/server/admin");
const { makeOrder } = await import("@/lib/testing/factories");

const ADMIN_KEY = "test-admin-key";
const owner: User = { id: "owner-bio", name: "Bio Owner", email: "bio@example.com", role: "business_owner" };
const rival: User = { id: "owner-tru", name: "Tru Owner", email: "tru@example.com", role: "business_owner" };
const customer: User = { id: "user-jane", name: "Jane", email: "jane@example.com", role: "customer" };

let dataDir: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T07:00:00Z")); // Mon 10:00 Nairobi
  dataDir = await mkdtemp(path.join(tmpdir(), "mf-fulfil-"));
  process.env.MF_DATA_DIR = dataDir;
  process.env.MF_ADMIN_KEY = ADMIN_KEY;
  delete process.env.MF_PAYMENTS_MODE;
  session.user = null;
  owners.map = { [owner.id]: ["bio-water-kasarani"], [rival.id]: ["truflow-nyali"] };
  sent.messages = [];
  prefs.orderUpdates = true;
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.MF_DATA_DIR;
  delete process.env.MF_ADMIN_KEY;
  await rm(dataDir, { recursive: true, force: true });
});

const ORDER_ID = "fulfil-order-1";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const riderCtx = (token: string) => ({ params: Promise.resolve({ token }) });

function json(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const patch = (body: unknown, id = ORDER_ID, headers: Record<string, string> = {}) =>
  PATCH(json("PATCH", `http://localhost/api/orders/${id}`, body, headers), ctx(id));

async function place(overrides: Record<string, unknown> = {}) {
  const response = await createRoute(
    json("POST", "http://localhost/api/orders", {
      id: ORDER_ID,
      businessId: "bio-water-kasarani",
      businessName: "BioWater Refill Station",
      customerName: "Jane Wanjiku",
      customerPhone: "0712345678",
      items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 2, unitPrice: 350 }],
      subtotal: 700,
      deliveryFee: 120,
      total: 820,
      payment: "mpesa",
      paymentState: "pending",
      status: "pending",
      address: { label: "Home", estate: "Kasarani", phone: "0712345678" },
      placedAt: "2026-09-21T10:42:00.000Z",
      ...overrides,
    })
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { order: Order }).order;
}

/** Confirm payment the way the provider callback does. */
async function pay(orderId = ORDER_ID) {
  const { payment } = await initiatePayment({
    orderIds: [orderId],
    phone: "0712345678",
    method: "mpesa",
    idempotencyKey: `pay-${orderId}`,
  });
  await applyProviderOutcome({ paymentId: payment.id, outcome: "success", receipt: `R-${orderId}`, amount: payment.amount });
  return payment.id;
}

async function body<T>(response: Response) {
  return (await response.json()) as T;
}

function tokenFrom(link: string) {
  return link.replace(/^\/rider\//, "");
}

describe("authorization", () => {
  it("refuses fulfilment and order lists without a staff session", async () => {
    await place();
    expect((await patch({ status: "accepted" })).status).toBe(401);
    expect((await listRoute(new NextRequest("http://localhost/api/orders"))).status).toBe(401);
    expect((await locationGet(new Request("http://localhost"), ctx(ORDER_ID))).status).toBe(401);

    session.user = customer;
    expect((await patch({ status: "accepted" })).status).toBe(401);
  });

  it("keeps each station inside its own orders", async () => {
    await place();
    await seedOrder(makeOrder({ id: "tru-order", businessId: "truflow-nyali", businessName: "TruFlow", status: "pending" }));

    session.user = owner;
    const mine = await body<{ orders: Order[] }>(await listRoute(new NextRequest("http://localhost/api/orders")));
    expect(mine.orders.map((o) => o.id)).toEqual([ORDER_ID]);
    expect(mine.orders[0]).not.toHaveProperty("customerUserId");
    expect(
      (await listRoute(new NextRequest("http://localhost/api/orders?businessId=truflow-nyali"))).status
    ).toBe(403);

    expect((await patch({ status: "rejected" }, "tru-order")).status).toBe(404);
    expect((await locationGet(new Request("http://localhost"), ctx("tru-order"))).status).toBe(404);

    session.user = rival;
    expect((await patch({ status: "rejected" })).status).toBe(404);
  });

  it("lets the platform admin act on any station with the bearer key or a session cookie", async () => {
    await place();
    await pay();
    const bearer = { authorization: ["Bearer", ADMIN_KEY].join(" ") };
    const list = await listRoute(new NextRequest("http://localhost/api/orders", { headers: bearer }));
    expect((await body<{ orders: Order[] }>(list)).orders).toHaveLength(1);

    const cookie = { cookie: `${ADMIN_COOKIE}=${issueAdminToken()}` };
    const accepted = await patch({ status: "accepted" }, ORDER_ID, cookie);
    expect(accepted.status).toBe(200);
    expect((await body<{ order: Order }>(accepted)).order.timeline?.at(-1)?.actor).toBe("admin");

    expect((await patch({ status: "preparing" }, ORDER_ID, { cookie: `${ADMIN_COOKIE}=1.forged` })).status).toBe(401);
  });
});

describe("lifecycle", () => {
  it("will not accept an order before payment is verified", async () => {
    await place();
    session.user = owner;
    const response = await patch({ status: "accepted" });
    expect(response.status).toBe(409);
    expect((await body<{ error: string }>(response)).error).toMatch(/payment/i);
  });

  it("refuses skipped steps and client-set payment state", async () => {
    await place();
    await pay();
    session.user = owner;
    expect((await patch({ status: "out_for_delivery" })).status).toBe(409);
    expect((await patch({ paymentState: "success" })).status).toBe(400);
    expect((await patch({ status: "accepted" })).status).toBe(200);
    expect((await patch({ status: "delivered" })).status).toBe(409);
  });

  it("runs payment -> accept -> prepare -> rider -> pickup -> delivered with a one-time rider link", async () => {
    session.user = customer;
    await place();
    await pay();

    session.user = owner;
    expect((await patch({ status: "accepted" })).status).toBe(200);
    expect((await patch({ status: "preparing" })).status).toBe(200);

    const missing = await patch({ status: "rider_assigned", rider: { name: "", phone: "123" } });
    expect(missing.status).toBe(422);
    expect(Object.keys((await body<{ fields: Record<string, string> }>(missing)).fields)).toEqual(
      expect.arrayContaining(["riderName", "riderPhone"])
    );

    const assigned = await patch({ status: "rider_assigned", rider: { name: "Otieno Juma", phone: "0722000111" } });
    expect(assigned.status).toBe(200);
    const { order: withRider, riderLink } = await body<{ order: Order; riderLink: string }>(assigned);
    expect(withRider.status).toBe("rider_assigned");
    expect(withRider).not.toHaveProperty("riderTokenHash");
    expect(riderLink).toMatch(/^\/rider\/[A-Za-z0-9_-]{20,}$/);
    const token = tokenFrom(riderLink);

    const view = await body<{ order: Record<string, unknown> }>(await riderGet(new Request("http://localhost"), riderCtx(token)));
    expect(view.order).toMatchObject({ id: ORDER_ID, status: "rider_assigned", riderName: "Otieno Juma" });
    expect(view.order).not.toHaveProperty("customerUserId");
    expect(view.order).not.toHaveProperty("total");

    const early = await riderPost(json("POST", "http://localhost", { action: "deliver" }), riderCtx(token));
    expect(early.status).toBe(409);
    expect((await riderPost(json("POST", "http://localhost", { action: "pickup" }), riderCtx(token))).status).toBe(200);
    const done = await riderPost(json("POST", "http://localhost", { action: "deliver" }), riderCtx(token));
    expect((await body<{ order: { status: string } }>(done)).order.status).toBe("delivered");

    // The link dies with the delivery.
    expect((await riderGet(new Request("http://localhost"), riderCtx(token))).status).toBe(404);

    session.user = null;
    const tracked = (await body<{ order: Order }>(await getRoute(new Request("http://localhost"), ctx(ORDER_ID)))).order;
    expect(tracked.status).toBe("delivered");
    expect(tracked).not.toHaveProperty("customerUserId");
    expect(tracked.timeline?.map((t) => [t.status, t.actor])).toEqual([
      ["pending", undefined],
      ["accepted", "station"],
      ["preparing", "station"],
      ["rider_assigned", "station"],
      ["out_for_delivery", "rider"],
      ["delivered", "rider"],
    ]);

    expect(sent.messages.map((m) => m.status)).toEqual(["accepted", "rider_assigned", "out_for_delivery", "delivered"]);
    expect(sent.messages.every((m) => m.to === "0712345678")).toBe(true);
    expect(sent.messages[1].message).toMatch(/Otieno Juma/);
  });

  it("revokes the old rider link on reassignment and when the rider is released", async () => {
    await place();
    await pay();
    session.user = owner;
    await patch({ status: "accepted" });
    await patch({ status: "preparing" });
    const first = tokenFrom(
      (await body<{ riderLink: string }>(await patch({ status: "rider_assigned", rider: { name: "Ann", phone: "0722000111" } }))).riderLink
    );
    const second = tokenFrom(
      (await body<{ riderLink: string }>(await patch({ status: "rider_assigned", rider: { name: "Ben", phone: "0722000222" } }))).riderLink
    );
    expect((await riderGet(new Request("http://localhost"), riderCtx(first))).status).toBe(404);
    expect((await riderGet(new Request("http://localhost"), riderCtx(second))).status).toBe(200);

    const released = await patch({ status: "preparing" });
    expect((await body<{ order: Order }>(released)).order.rider).toBeUndefined();
    expect((await riderGet(new Request("http://localhost"), riderCtx(second))).status).toBe(404);
  });
});

describe("rejection and refunds", () => {
  it("hands a paid rejection to refunds and reflects confirmation on the order", async () => {
    await place();
    const paymentId = await pay();
    session.user = owner;

    const rejected = await patch({ status: "rejected", reason: "Out of 20L cans today" });
    expect(rejected.status).toBe(200);
    const order = (await body<{ order: Order }>(rejected)).order;
    expect(order.closedReason).toBe("Out of 20L cans today");
    expect(order.refund).toMatchObject({ status: "pending", amount: 820 });
    expect(sent.messages.at(-1)?.message).toMatch(/Out of 20L cans today.*refund/);

    const payment = await getPayment(paymentId);
    expect(payment?.refunds).toHaveLength(1);
    expect(payment?.refunds[0]).toMatchObject({ status: "pending", orderIds: [ORDER_ID], amount: 820 });

    // Retrying the rejection can neither change the order nor double the refund.
    expect((await patch({ status: "rejected" })).status).toBe(409);
    expect((await getPayment(paymentId))?.refunds).toHaveLength(1);

    await confirmRefund(payment!.refunds[0].id, "REV-1");
    session.user = null;
    const tracked = (await body<{ order: Order }>(await getRoute(new Request("http://localhost"), ctx(ORDER_ID)))).order;
    expect(tracked.paymentState).toBe("refunded");
    expect(tracked.refund).toMatchObject({ status: "confirmed" });
  });

  it("closes an unpaid order without a refund", async () => {
    await place();
    session.user = owner;
    const order = (await body<{ order: Order }>(await patch({ status: "rejected" }))).order;
    expect(order.status).toBe("rejected");
    expect(order.refund).toBeUndefined();
    expect(order.closedReason).toBeTruthy();
  });

  it("refunds a paid order the station cancels mid-preparation", async () => {
    await place();
    await pay();
    session.user = owner;
    await patch({ status: "accepted" });
    await patch({ status: "preparing" });
    const order = (await body<{ order: Order }>(await patch({ status: "cancelled", reason: "Pump broke" }))).order;
    expect(order.refund?.status).toBe("pending");
    expect((await patch({ status: "preparing" })).status).toBe(409);
  });
});

describe("customer consent", () => {
  it("sends no status messages when the customer opted out for the order", async () => {
    await place({ consent: { location: false, smsUpdates: false } });
    await pay();
    session.user = owner;
    await patch({ status: "accepted" });
    expect(sent.messages).toEqual([]);
  });

  it("honours an account-level opt-out from order updates", async () => {
    session.user = customer;
    await place();
    await pay();
    prefs.orderUpdates = false;
    session.user = owner;
    await patch({ status: "accepted" });
    expect(sent.messages).toEqual([]);
  });

  it("collects live location only with consent, only while active, and deletes it afterwards", async () => {
    await place();
    await pay();
    const fix = { lat: -1.22, lng: 36.89, accuracy: 12 };
    const postFix = () => locationPost(json("POST", "http://localhost", fix), ctx(ORDER_ID));

    expect((await postFix()).status).toBe(409);
    const consented = await consentRoute(json("POST", "http://localhost", { location: true }), ctx(ORDER_ID));
    expect((await body<{ order: Order }>(consented)).order.consent).toMatchObject({ location: true });
    expect((await postFix()).status).toBe(201);

    // The public tracking view never carries the trail; the owning station does.
    const publicView = (await body<{ order: Order }>(await getRoute(new Request("http://localhost"), ctx(ORDER_ID)))).order;
    expect(publicView).not.toHaveProperty("location");
    session.user = owner;
    const trail = await body<{ location: unknown; history: unknown[] }>(await locationGet(new Request("http://localhost"), ctx(ORDER_ID)));
    expect(trail.location).toMatchObject({ lat: -1.22 });

    await patch({ status: "accepted" });
    await patch({ status: "preparing" });
    await patch({ status: "rider_assigned", rider: { name: "Ann", phone: "0722000111" } });
    await patch({ status: "out_for_delivery" });
    await patch({ status: "delivered" });

    const after = await body<{ location: unknown; history: unknown[] }>(await locationGet(new Request("http://localhost"), ctx(ORDER_ID)));
    expect(after.location).toBeNull();
    expect(after.history).toEqual([]);
    expect((await postFix()).status).toBe(409);
  });

  it("deletes the trail as soon as the customer withdraws consent", async () => {
    await place({ consent: { location: true, smsUpdates: true } });
    await locationPost(json("POST", "http://localhost", { lat: -1.2, lng: 36.8 }), ctx(ORDER_ID));
    await consentRoute(json("POST", "http://localhost", { location: false }), ctx(ORDER_ID));
    session.user = owner;
    const trail = await body<{ location: unknown; history: unknown[] }>(await locationGet(new Request("http://localhost"), ctx(ORDER_ID)));
    expect(trail).toMatchObject({ location: null, history: [] });
  });
});
