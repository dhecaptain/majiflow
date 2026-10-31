import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * The console's SQL against a real database. Runs only when
 * MF_TEST_DATABASE_URL points at a throwaway, migrated database (see
 * doc-store.postgres.test.ts for the commands). Every table it touches is
 * emptied first, so never point it at real data.
 */
const url = process.env.MF_TEST_DATABASE_URL;

const NOW = new Date("2026-10-31T07:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const WEEK = { monday: { open: "07:00", close: "19:00" } };

describe.skipIf(!url)("admin insights on Postgres", () => {
  let insights: typeof import("@/lib/server/admin-insights");
  let publication: typeof import("@/lib/server/station-publication");
  let auth: typeof import("@/lib/server/auth");
  let db: Awaited<ReturnType<typeof import("@/lib/server/db").getDatabase>>;
  let schema: typeof import("@/lib/server/db/schema");
  const ids = { ops: "", owner: "", customer: "", live: "", draft: "" };

  beforeAll(async () => {
    delete process.env.MF_DATA_DIR;
    process.env.DATABASE_URL = url;
    insights = await import("@/lib/server/admin-insights");
    publication = await import("@/lib/server/station-publication");
    auth = await import("@/lib/server/auth");
    schema = await import("@/lib/server/db/schema");
    db = await (await import("@/lib/server/db")).getDatabase();
  });

  beforeEach(async () => {
    await db.pool.query(
      "TRUNCATE orders, business_products, subscriptions, businesses, business_applications, sessions, users CASCADE"
    );
    const { users, businessApplications, businesses, subscriptions, businessProducts, orders } = schema;
    const [ops, owner, customer] = await db.db
      .insert(users)
      .values([
        { name: "Ops", email: "ops@example.com", role: "operations" },
        { name: "Wanjiku Owner", email: "owner@example.com", phone: "0711000001", role: "business_owner" },
        { name: "Otieno Customer", phone: "0722000002", role: "customer", createdAt: hoursAgo(5) },
      ])
      .returning({ id: users.id });
    Object.assign(ids, { ops: ops.id, owner: owner.id, customer: customer.id });

    const application = {
      ownerUserId: owner.id,
      status: "approved" as const,
      ownerName: "Wanjiku Owner",
      phone: "0711000001",
      email: "owner@example.com",
      address: "Kasarani Rd",
      city: "Nairobi",
      deliveryFee: "50",
      deliveryTimeMinutes: 45,
      plan: "growth" as const,
    };
    const [appLive, appDraft] = await db.db
      .insert(businessApplications)
      .values([
        { ...application, businessName: "Live Water" },
        { ...application, businessName: "Draft Water" },
      ])
      .returning({ id: businessApplications.id });
    const [live, draft] = await db.db
      .insert(businesses)
      .values([
        { ownerUserId: owner.id, applicationId: appLive.id, slug: "live-water", name: "Live Water", isComplete: true, isPublished: true, openingHours: WEEK },
        { ownerUserId: owner.id, applicationId: appDraft.id, slug: "draft-water", name: "Draft Water" },
      ])
      .returning({ id: businesses.id });
    Object.assign(ids, { live: live.id, draft: draft.id });

    await db.db.insert(subscriptions).values({
      businessId: live.id,
      plan: "growth",
      status: "active",
      paymentConfirmedAt: hoursAgo(100),
      currentPeriodStart: hoursAgo(100),
      currentPeriodEnd: new Date(NOW.getTime() + 20 * 86_400_000),
    });
    await db.db.insert(businessProducts).values([
      { businessId: live.id, name: "20L refill", description: "", category: "refill", unit: "20L", price: "200" },
      { businessId: live.id, name: "Hidden", description: "", category: "refill", unit: "5L", price: "80", isVisible: false },
    ]);

    const order = (n: number, over: { status: string; payment: string; paymentState: string; total: number; placedAt: Date; customerUserId?: string }) => ({
      id: `o-${n}`,
      orderNumber: `MF-T${n}`,
      businessId: live.id,
      customerUserId: over.customerUserId ?? null,
      customerPhone: "0722000002",
      status: over.status,
      placedAt: over.placedAt,
      data: { businessName: "Live Water", ...over },
    });
    await db.db.insert(orders).values([
      order(1, { status: "delivered", payment: "cod", paymentState: "success", total: 450, placedAt: hoursAgo(2), customerUserId: customer.id }),
      order(2, { status: "out_for_delivery", payment: "cod", paymentState: "pending", total: 250, placedAt: hoursAgo(1), customerUserId: customer.id }),
      order(3, { status: "cancelled", payment: "mpesa", paymentState: "cancelled", total: 900, placedAt: hoursAgo(30) }),
      order(4, { status: "delivered", payment: "cod", paymentState: "success", total: 300, placedAt: hoursAgo(24 * 40) }),
    ]);
  });

  afterAll(async () => {
    await db?.pool.end();
  });

  it("builds the overview from live data", async () => {
    const result = await insights.getPlatformInsights(30, NOW);
    expect(result.summary.orders).toBe(3);
    expect(result.summary.previousOrders).toBe(1);
    expect(result.summary.deliveredValue).toBe(450);
    expect(result.summary.cashToCollect).toBe(250);
    expect(result.summary.topStations[0]).toMatchObject({ name: "Live Water", orders: 3 });
    expect(result.stations).toMatchObject({ total: 2, live: 1, setup: 1 });
    expect(result.monthlyRecurringRevenue).toBe(4500);
    expect(result.users).toMatchObject({ customers: 1, owners: 1, newCustomers: 1 });
  });

  it("lists every station with its state, products and order stats", async () => {
    const stations = await insights.listAdminStations(NOW);
    const live = stations.find((s) => s.id === ids.live)!;
    expect(live).toMatchObject({ state: "live", products: 2, visibleProducts: 1, orders30d: 3, deliveredValue30d: 450, ordersAllTime: 4, paid: true });
    const draft = stations.find((s) => s.id === ids.draft)!;
    expect(draft.state).toBe("setup");
    expect(draft.issues).toContain("No visible products");
  });

  it("suspending a station hides it from the public catalog", async () => {
    expect(await publication.queryEligiblePublishedDatabaseBusinesses(NOW)).toHaveLength(1);
    await insights.setStationSuspended(ids.live, true, "Licence expired");
    expect(await publication.queryEligiblePublishedDatabaseBusinesses(NOW)).toHaveLength(0);
    const live = (await insights.listAdminStations(NOW)).find((s) => s.id === ids.live)!;
    expect(live).toMatchObject({ state: "suspended", suspensionReason: "Licence expired" });
    await insights.setStationSuspended(ids.live, false);
    expect(await publication.queryEligiblePublishedDatabaseBusinesses(NOW)).toHaveLength(1);
  });

  it("searches users and reports their activity", async () => {
    const byPhone = await insights.listAdminUsers({ q: "+254 722" });
    expect(byPhone.users.map((u) => u.id)).toEqual([ids.customer]);
    expect(byPhone.users[0]).toMatchObject({ orders: 2, deliveredValue: 450 });
    const owners = await insights.listAdminUsers({ role: "business_owner" });
    expect(owners.users[0]).toMatchObject({ id: ids.owner, stations: 2 });
    const detail = await insights.getAdminUser(ids.customer);
    expect(detail?.recentOrders.map((o) => o.orderNumber)).toEqual(["MF-T2", "MF-T1"]);
  });

  it("disables an account, ends its sessions and blocks phone sign-in", async () => {
    await db.db.insert(schema.sessions).values({ userId: ids.customer, tokenHash: "x".repeat(64), expiresAt: new Date(Date.now() + 86_400_000) });
    await insights.setUserDisabled(ids.customer, true, ids.ops);
    expect(await db.db.select().from(schema.sessions)).toHaveLength(0);
    await expect(auth.authenticatePhone("0722000002")).rejects.toThrow(/disabled/);
    await insights.setUserDisabled(ids.customer, false, ids.ops);
    await expect(auth.authenticatePhone("0722000002")).resolves.toMatchObject({ id: ids.customer });
  });

  it("refuses to disable operations accounts or yourself", async () => {
    await expect(insights.setUserDisabled(ids.ops, true, ids.customer)).rejects.toThrow(/Operations/);
    await expect(insights.setUserDisabled(ids.owner, true, ids.owner)).rejects.toThrow(/your own/);
  });
});
