import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businesses, businessApplications, subscriptions } from "@/lib/server/db/schema";

export const subscriptionStatuses = ["trialing", "active", "expired", "cancelled"] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const planNames = ["starter", "growth", "pro"] as const;
export type PlanName = (typeof planNames)[number];

export const TRIAL_DURATION_DAYS = 14;

export interface SubscriptionRecord {
  id?: string;
  businessId: string;
  plan: PlanName;
  status: SubscriptionStatus;
  trialStartedAt: Date | string | null;
  trialEndsAt: Date | string | null;
  currentPeriodStart: Date | string | null;
  currentPeriodEnd: Date | string | null;
  paymentConfirmedAt?: Date | string | null;
  paymentReference?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SubscriptionEligibilityResult {
  eligible: boolean;
  reason?: string;
  type?: "trial" | "paid";
}

export class SubscriptionError extends Error {}
export class SubscriptionConflictError extends SubscriptionError {}
export class SubscriptionNotFoundError extends Error {}
export class SubscriptionUnauthorizedError extends Error {}

function isPlanName(value: unknown): value is PlanName {
  return typeof value === "string" && (planNames as readonly string[]).includes(value);
}

/**
 * Authoritative, pure function evaluating subscription eligibility.
 * Evaluates whether a subscription meets the rules for station publication.
 *
 * Requirements:
 * - Free trial must have valid start/end timestamps and current time within window.
 * - Active paid subscription must have valid period timestamps AND trusted payment confirmation.
 * - Expired, cancelled, or missing subscriptions do not qualify.
 */
export function evaluateSubscriptionEligibility(
  subscription: SubscriptionRecord | null | undefined,
  now = new Date()
): SubscriptionEligibilityResult {
  if (!subscription) {
    return { eligible: false, reason: "No subscription record found." };
  }

  if (subscription.status === "cancelled") {
    return { eligible: false, reason: "Subscription has been cancelled." };
  }

  if (subscription.status === "expired") {
    return { eligible: false, reason: "Subscription has expired." };
  }

  const current = now.getTime();

  if (subscription.status === "trialing") {
    if (!subscription.trialStartedAt || !subscription.trialEndsAt) {
      return { eligible: false, reason: "Trial window timestamps are incomplete." };
    }

    const start = new Date(subscription.trialStartedAt).getTime();
    const end = new Date(subscription.trialEndsAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      return { eligible: false, reason: "Trial window timestamps are invalid." };
    }

    if (current < start) {
      return { eligible: false, reason: "Trial period has not started yet." };
    }

    if (current > end) {
      return { eligible: false, reason: "Free trial period has expired." };
    }

    return { eligible: true, type: "trial" };
  }

  if (subscription.status === "active") {
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      return { eligible: false, reason: "Subscription period timestamps are incomplete." };
    }

    const start = new Date(subscription.currentPeriodStart).getTime();
    const end = new Date(subscription.currentPeriodEnd).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      return { eligible: false, reason: "Subscription period timestamps are invalid." };
    }

    if (current < start) {
      return { eligible: false, reason: "Subscription period has not started yet." };
    }

    if (current > end) {
      return { eligible: false, reason: "Subscription period has expired." };
    }

    // Require trustworthy server-side confirmation of payment
    if (!subscription.paymentConfirmedAt) {
      return { eligible: false, reason: "Active paid subscription has no verified payment confirmation." };
    }

    const confirmedAt = new Date(subscription.paymentConfirmedAt).getTime();
    if (Number.isNaN(confirmedAt)) {
      return { eligible: false, reason: "Payment confirmation timestamp is invalid." };
    }

    return { eligible: true, type: "paid" };
  }

  return { eligible: false, reason: `Invalid subscription status: ${subscription.status}` };
}

/**
 * Fetch the subscription for a given business ID from the database.
 */
export async function getSubscriptionForBusiness(businessId: string): Promise<SubscriptionRecord | null> {
  const { db } = await getDatabase();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);

  return (subscription as SubscriptionRecord) ?? null;
}

/**
 * Start a 14-day free trial for a business.
 * Started explicitly by the owner after application approval, not on application submission.
 * Clients cannot pass arbitrary timestamps or bypass checks.
 */
export async function startFreeTrial(
  businessId: string,
  ownerUserId: string,
  plan?: PlanName,
  now = new Date()
) {
  if (plan !== undefined && !isPlanName(plan)) {
    throw new SubscriptionError("Plan is invalid.");
  }

  const { db } = await getDatabase();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) throw new SubscriptionNotFoundError("Business not found.");
  if (business.ownerUserId !== ownerUserId) {
    throw new SubscriptionUnauthorizedError("You do not own this business.");
  }

  const [application] = await db
    .select()
    .from(businessApplications)
    .where(eq(businessApplications.id, business.applicationId))
    .limit(1);

  if (!application || application.status !== "approved") {
    throw new SubscriptionError("A free trial can only be started for an approved application.");
  }

  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);

  if (existingSubscription) {
    throw new SubscriptionConflictError("A subscription or trial already exists for this business.");
  }

  const chosenPlan: PlanName = plan ?? (isPlanName(application.plan) ? application.plan : "growth");
  const trialStartedAt = now;
  const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(subscriptions)
    .values({
      businessId,
      plan: chosenPlan,
      status: "trialing",
      trialStartedAt,
      trialEndsAt,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paymentConfirmedAt: null,
      paymentReference: null,
    })
    .onConflictDoNothing({ target: subscriptions.businessId })
    .returning();

  if (!created) {
    throw new SubscriptionConflictError("A subscription or trial already exists for this business.");
  }

  return created as SubscriptionRecord;
}

/**
 * Record confirmed paid subscription activation through a trusted server-side process.
 * Never callable directly by untrusted client payloads.
 */
export async function recordConfirmedPaidSubscription(
  businessId: string,
  details: {
    plan: PlanName;
    periodStart: Date;
    periodEnd: Date;
    paymentReference: string;
    confirmedAt?: Date;
  }
) {
  if (!details.paymentReference?.trim()) {
    throw new SubscriptionError("A trusted payment reference is required.");
  }

  const startTime = details.periodStart.getTime();
  const endTime = details.periodEnd.getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    throw new SubscriptionError("Paid subscription period timestamps are invalid.");
  }
  if (startTime >= endTime) {
    throw new SubscriptionError("Paid subscription period start must be strictly before period end.");
  }

  const { db } = await getDatabase();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) throw new SubscriptionNotFoundError("Business not found.");

  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);

  const confirmedAt = details.confirmedAt ?? new Date();

  if (existingSubscription) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: details.plan,
        status: "active",
        currentPeriodStart: details.periodStart,
        currentPeriodEnd: details.periodEnd,
        paymentConfirmedAt: confirmedAt,
        paymentReference: details.paymentReference.trim(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existingSubscription.id))
      .returning();

    return updated as SubscriptionRecord;
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      businessId,
      plan: details.plan,
      status: "active",
      currentPeriodStart: details.periodStart,
      currentPeriodEnd: details.periodEnd,
      paymentConfirmedAt: confirmedAt,
      paymentReference: details.paymentReference.trim(),
    })
    .returning();

  return created as SubscriptionRecord;
}
