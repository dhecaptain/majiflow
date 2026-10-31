import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "business_owner", "operations"]);
export const applicationStatus = pgEnum("business_application_status", [
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);
export const planName = pgEnum("plan_name", ["starter", "growth", "pro"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "expired",
  "cancelled",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Optional: phone-first customers sign in with an SMS code and never set one. */
    email: varchar("email", { length: 320 }),
    name: varchar("name", { length: 120 }).notNull(),
    /** Kenyan mobile number in local form (07XXXXXXXXX / 01XXXXXXXXX). */
    phone: varchar("phone", { length: 20 }),
    /** Optional: phone-first customers have no password. */
    passwordHash: text("password_hash"),
    role: userRole("role").default("customer").notNull(),
    ...timestamps,
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    phoneUnique: uniqueIndex("users_phone_unique").on(table.phone),
  })
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
}));

export const businessApplications = pgTable("business_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: applicationStatus("status").default("submitted").notNull(),
  rejectionReason: text("rejection_reason"),
  businessName: varchar("business_name", { length: 160 }).notNull(),
  ownerName: varchar("owner_name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  description: text("description"),
  registrationNumber: varchar("registration_number", { length: 80 }),
  address: varchar("address", { length: 240 }).notNull(),
  city: varchar("city", { length: 80 }).notNull(),
  zones: text("zones"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  deliveryTimeMinutes: integer("delivery_time_minutes").notNull(),
  plan: planName("plan").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => businessApplications.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 180 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    isComplete: boolean("is_complete").default(false).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    applicationUnique: uniqueIndex("businesses_application_unique").on(table.applicationId),
    slugUnique: uniqueIndex("businesses_slug_unique").on(table.slug),
  })
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 40 }).notNull(),
    estate: varchar("estate", { length: 60 }).notNull(),
    street: varchar("street", { length: 120 }),
    building: varchar("building", { length: 60 }),
    floor: varchar("floor", { length: 60 }),
    city: varchar("city", { length: 40 }),
    landmark: varchar("landmark", { length: 500 }),
    notes: varchar("notes", { length: 500 }),
    phone: varchar("phone", { length: 20 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracy: doublePrecision("accuracy"),
    locationAt: timestamp("location_at", { withTimezone: true }),
    isDefault: boolean("is_default").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    userIdx: index("customer_addresses_user_idx").on(table.userId),
  })
);

export const customerPreferences = pgTable("customer_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  orderUpdates: boolean("order_updates").default(true).notNull(),
  marketing: boolean("marketing").default(false).notNull(),
  notificationsReadAt: timestamp("notifications_read_at", { withTimezone: true }),
  /** Last fulfilment the customer chose ("delivery" | "pickup"). */
  fulfilment: varchar("fulfilment", { length: 10 }),
  /** Station the customer ordered from last, so we can preselect it. */
  lastStationId: varchar("last_station_id", { length: 180 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authOtpCodes = pgTable(
  "auth_otp_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Kenyan mobile number in E.164 form (254XXXXXXXXX). */
    phone: varchar("phone", { length: 20 }).notNull(),
    /** HMAC of the code, never the code itself. */
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 16 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    phonePurposeIdx: index("auth_otp_codes_phone_purpose_idx").on(table.phone, table.purpose),
  })
);

export const stationInterest = pgTable(
  "station_interest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Signed-in customer, when there is one. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Kenyan mobile number in E.164 form (254XXXXXXXXX). */
    phone: varchar("phone", { length: 20 }),
    /** Free-text area the customer asked about, e.g. "Kawangware". */
    area: varchar("area", { length: 120 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    /** Station they asked about, when the customer picked one. */
    businessId: varchar("business_id", { length: 180 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    phoneIdx: index("station_interest_phone_idx").on(table.phone),
    areaIdx: index("station_interest_area_idx").on(table.area),
  })
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: planName("plan").notNull(),
    status: subscriptionStatus("status").default("trialing").notNull(),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 120 }),
    ...timestamps,
  },
  (table) => ({
    businessUnique: uniqueIndex("subscriptions_business_id_unique").on(table.businessId),
  })
);

/**
 * Customer orders. The whole order document lives in `data`; the columns
 * beside it are copies of the fields the app filters on, kept in step by the
 * order store on every write.
 */
export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 80 }).primaryKey(),
    /** The checkout attempt that created the order, so a retry never duplicates it. */
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    orderNumber: varchar("order_number", { length: 24 }).notNull(),
    businessId: varchar("business_id", { length: 180 }).notNull(),
    customerUserId: varchar("customer_user_id", { length: 80 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    status: varchar("status", { length: 24 }).notNull(),
    riderTokenHash: varchar("rider_token_hash", { length: 64 }),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull(),
    data: jsonb("data").notNull(),
    ...timestamps,
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("orders_idempotency_key_unique").on(table.idempotencyKey),
    orderNumberUnique: uniqueIndex("orders_order_number_unique").on(table.orderNumber),
    businessIdx: index("orders_business_id_idx").on(table.businessId, table.placedAt),
    customerIdx: index("orders_customer_user_id_idx").on(table.customerUserId),
    phoneIdx: index("orders_customer_phone_idx").on(table.customerPhone),
    statusIdx: index("orders_status_idx").on(table.status),
    riderTokenIdx: index("orders_rider_token_hash_idx").on(table.riderTokenHash),
  })
);

/** Payment attempts and their refunds, one document per payment. */
export const payments = pgTable(
  "payments",
  {
    id: varchar("id", { length: 80 }).primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull(),
    checkoutRequestId: varchar("checkout_request_id", { length: 120 }),
    status: varchar("status", { length: 16 }).notNull(),
    orderIds: text("order_ids").array().notNull(),
    refundIds: text("refund_ids").array().notNull(),
    data: jsonb("data").notNull(),
    ...timestamps,
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("payments_idempotency_key_unique").on(table.idempotencyKey),
    checkoutRequestUnique: uniqueIndex("payments_checkout_request_id_unique").on(table.checkoutRequestId),
    orderIdsIdx: index("payments_order_ids_idx").using("gin", table.orderIds),
    refundIdsIdx: index("payments_refund_ids_idx").using("gin", table.refundIds),
  })
);
