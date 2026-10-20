import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string; email: string; role: "customer" } }));

vi.mock("@/lib/server/auth", () => {
  class AuthenticationError extends Error {}
  return {
    AuthenticationError,
    requireCustomer: async () => {
      if (!session.user) throw new AuthenticationError("Customer access is required.");
      return session.user;
    },
    getOptionalCustomer: async () => session.user,
    getCurrentUser: async () => session.user,
  };
});

const { POST: createOrderRoute, GET: publicList } = await import("@/app/api/orders/route");
const { GET: listRoute } = await import("@/app/api/account/orders/route");
const { GET: detailRoute } = await import("@/app/api/account/orders/[id]/route");
const { POST: reorderRoute } = await import("@/app/api/account/orders/[id]/reorder/route");
const { POST: cancelRoute } = await import("@/app/api/account/orders/[id]/cancel/route");
const { PAYMENT_TIMEOUT_MS } = await import("@/lib/server/payments");
const { ADMIN_COOKIE, issueAdminToken } = await import("@/lib/server/admin");

const jane = { id: "user-jane", name: "Jane", email: "jane@example.com", role: "customer" as const };
const otto = { id: "user-otto", name: "Otto", email: "otto@example.com", role: "customer" as const };

let dataDir: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T07:00:00Z")); // Mon 10:00 Nairobi
  dataDir = await mkdtemp(path.join(tmpdir(), "mf-account-"));
  process.env.MF_DATA_DIR = dataDir;
  process.env.MF_ADMIN_KEY = "test-admin-key";
  session.user = null;
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.MF_DATA_DIR;
  delete process.env.MF_ADMIN_KEY;
  await rm(dataDir, { recursive: true, force: true });
});

function orderBody(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
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
    placedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function placeOrder(as: typeof jane | null, id: string, overrides: Record<string, unknown> = {}) {
  session.user = as;
  const response = await createOrderRoute(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(orderBody(id, overrides)),
    })
  );
  expect(response.status).toBe(201);
  session.user = null;
  return (await response.json()).order;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const listRequest = (filter = "all") =>
  new Request(`http://localhost/api/account/orders?filter=${filter}`);
const post = () => new Request("http://localhost", { method: "POST" });

describe("order ownership", () => {
  it("stamps the session customer on new orders but never exposes it publicly", async () => {
    const created = await placeOrder(jane, "o-jane", { customerUserId: "user-otto" });
    expect(created).not.toHaveProperty("customerUserId");

    const { orders } = await (
      await publicList(
        new NextRequest("http://localhost/api/orders", { headers: { cookie: `${ADMIN_COOKIE}=${issueAdminToken()}` } })
      )
    ).json();
    expect(orders[0]).not.toHaveProperty("customerUserId");

    session.user = jane;
    const mine = await (await listRoute(listRequest())).json();
    expect(mine.orders.map((o: { id: string }) => o.id)).toEqual(["o-jane"]);

    session.user = otto;
    expect((await (await listRoute(listRequest())).json()).orders).toEqual([]);
  });

  it("ignores guest orders and requires a customer session", async () => {
    await placeOrder(null, "o-guest");
    expect((await listRoute(listRequest())).status).toBe(401);
    session.user = jane;
    expect((await (await listRoute(listRequest())).json()).total).toBe(0);
  });

  it("filters by active and past and rejects unknown filters", async () => {
    await placeOrder(jane, "o-active");
    session.user = jane;
    expect((await (await listRoute(listRequest("active"))).json()).total).toBe(1);
    expect((await (await listRoute(listRequest("past"))).json()).total).toBe(0);
    expect((await listRoute(listRequest("everything"))).status).toBe(400);
  });

  it("hides another customer's order behind a 404", async () => {
    await placeOrder(jane, "o-jane");
    session.user = otto;
    expect((await detailRoute(post(), ctx("o-jane"))).status).toBe(404);
    expect((await reorderRoute(post(), ctx("o-jane"))).status).toBe(404);
    expect((await cancelRoute(post(), ctx("o-jane"))).status).toBe(404);

    session.user = jane;
    const detail = await (await detailRoute(post(), ctx("o-jane"))).json();
    expect(detail.order.id).toBe("o-jane");
    expect(detail.cancelBlockReason).toMatch(/being confirmed/);
  });
});

describe("reorder", () => {
  it("returns cart lines from today's catalog", async () => {
    await placeOrder(jane, "o-jane");
    session.user = jane;
    const response = await reorderRoute(post(), ctx("o-jane"));
    expect(response.status).toBe(200);
    const { plan } = await response.json();
    expect(plan.lines).toEqual([{ businessId: "bio-water-kasarani", productId: "bw-refill-20", quantity: 2 }]);
    expect(plan.skipped).toEqual([]);
  });
});

describe("cancel", () => {
  it("waits for the payment window, then cancels once", async () => {
    await placeOrder(jane, "o-jane");
    session.user = jane;
    expect((await cancelRoute(post(), ctx("o-jane"))).status).toBe(409);

    vi.setSystemTime(Date.now() + PAYMENT_TIMEOUT_MS + 1000);
    const response = await cancelRoute(post(), ctx("o-jane"));
    expect(response.status).toBe(200);
    const { order } = await response.json();
    expect(order.status).toBe("cancelled");
    expect(order.timeline.at(-1).status).toBe("cancelled");

    expect((await cancelRoute(post(), ctx("o-jane"))).status).toBe(409);
  });
});
