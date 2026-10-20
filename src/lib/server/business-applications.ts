import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businesses, businessApplications } from "@/lib/server/db/schema";
import { validateBusinessApplication } from "@/lib/server/business-application-validation";

export const applicationStatuses = ["submitted", "under_review", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export class BusinessApplicationNotFoundError extends Error {}
export class BusinessApplicationTransitionError extends Error {}
export class BusinessApplicationConflictError extends Error {}
export class BusinessApplicationSelfReviewError extends Error {}

type Database = Awaited<ReturnType<typeof getDatabase>>["db"];

/**
 * Executor accepted by business-record mutations. Only a transaction executor
 * is accepted so creating or linking a business record can never be committed
 * outside the transaction that persists the approval that triggered it.
 */
export type BusinessRecordExecutor = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function createBusinessApplication(ownerUserId: string, input: unknown) {
  const validation = validateBusinessApplication(input);
  if (!validation.success) return validation;
  const data = validation.data;
  const { db } = await getDatabase();
  const [application] = await db.insert(businessApplications).values({
    ownerUserId,
    status: "submitted",
    businessName: data.businessName,
    ownerName: data.ownerName,
    phone: data.phone,
    email: data.email,
    description: data.description,
    registrationNumber: data.registrationNumber,
    address: data.address,
    city: data.city,
    zones: data.zones,
    deliveryFee: data.deliveryFee.toFixed(2),
    deliveryTimeMinutes: data.deliveryTimeMinutes,
    plan: data.plan,
    latitude: data.latitude?.toFixed(6) ?? null,
    longitude: data.longitude?.toFixed(6) ?? null,
    submittedAt: new Date(),
  }).returning();
  return { success: true as const, application };
}

export async function listOwnerApplications(ownerUserId: string) {
  const { db } = await getDatabase();
  return db.select().from(businessApplications)
    .where(eq(businessApplications.ownerUserId, ownerUserId))
    .orderBy(desc(businessApplications.createdAt));
}

export async function listAllBusinessApplications() {
  const { db } = await getDatabase();
  return db.select().from(businessApplications).orderBy(desc(businessApplications.submittedAt), desc(businessApplications.createdAt));
}

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && applicationStatuses.includes(value as ApplicationStatus);
}

function canTransition(from: ApplicationStatus, to: ApplicationStatus) {
  return (from === "submitted" && to === "under_review") ||
    (from === "under_review" && (to === "approved" || to === "rejected"));
}

const MAX_REJECTION_REASON_LENGTH = 2000;

export function generateStationSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return base || "station";
}

export async function ensureBusinessForApplication(
  application: {
    id: string;
    ownerUserId: string;
    businessName: string;
  },
  executor: BusinessRecordExecutor
) {
  const findLinkedBusiness = async () => {
    const [linked] = await executor
      .select()
      .from(businesses)
      .where(eq(businesses.applicationId, application.id))
      .limit(1);
    return linked;
  };

  const existing = await findLinkedBusiness();
  if (existing) {
    return existing;
  }

  const baseSlug = generateStationSlug(application.businessName);
  // The second candidate embeds the full application id so it cannot collide
  // with another application's fallback slug and stays within varchar(180).
  const candidateSlugs = [
    baseSlug,
    `${baseSlug.slice(0, 140)}-${application.id.replace(/-/g, "")}`,
  ];

  for (const slug of candidateSlugs) {
    const [inserted] = await executor
      .insert(businesses)
      .values({
        ownerUserId: application.ownerUserId,
        applicationId: application.id,
        name: application.businessName,
        slug,
        isComplete: false,
        isPublished: false,
      })
      // DO NOTHING without a conflict target suppresses both unique indexes
      // (application and slug). It does not suppress any other error, which
      // must abort the caller's transaction; the re-select below separates a
      // concurrent link to this application from a taken slug.
      .onConflictDoNothing()
      .returning();

    if (inserted) return inserted;

    const linked = await findLinkedBusiness();
    if (linked) return linked;
  }

  throw new Error("Could not create or link business record for application.");
}

export async function updateBusinessApplicationStatus(
  applicationId: string,
  status: unknown,
  rejectionReason: unknown,
  reviewerUserId: string
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)) {
    throw new BusinessApplicationNotFoundError("Application was not found.");
  }
  if (!isApplicationStatus(status)) {
    throw new BusinessApplicationTransitionError("Status is invalid.");
  }
  let normalizedRejectionReason: string | null = null;
  if (status === "rejected") {
    if (typeof rejectionReason !== "string" || !rejectionReason.trim()) {
      throw new BusinessApplicationTransitionError("A rejection reason is required.");
    }
    if (rejectionReason.length > MAX_REJECTION_REASON_LENGTH) {
      throw new BusinessApplicationTransitionError(
        `Rejection reason must be ${MAX_REJECTION_REASON_LENGTH} characters or fewer.`
      );
    }
    normalizedRejectionReason = rejectionReason.trim();
  } else if (rejectionReason !== undefined) {
    throw new BusinessApplicationTransitionError(
      "A rejection reason is only allowed when rejecting an application."
    );
  }

  const { db } = await getDatabase();

  // The read, conditional update, and business linkage run in one transaction so
  // an approval can never be committed without its business record, and a failed
  // business creation rolls the status back to its previous (retryable) value.
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(businessApplications)
      .where(eq(businessApplications.id, applicationId))
      .limit(1);
    if (!current) throw new BusinessApplicationNotFoundError("Application was not found.");
    if (!isApplicationStatus(current.status)) {
      throw new BusinessApplicationTransitionError("The application has an invalid current status.");
    }
    if (!canTransition(current.status, status)) {
      throw new BusinessApplicationTransitionError(`Applications cannot move from ${current.status} to ${status}.`);
    }

    // Terminal decisions cannot be made by the application's own owner, even
    // when that owner holds the operations role.
    if ((status === "approved" || status === "rejected") && current.ownerUserId === reviewerUserId) {
      throw new BusinessApplicationSelfReviewError("Operations reviewers cannot decide their own business application.");
    }

    // Conditional on the previously read status so concurrent reviewers cannot
    // both transition the same application.
    const [updated] = await tx.update(businessApplications)
      .set({
        status,
        rejectionReason: normalizedRejectionReason,
        completedAt: status === "approved" || status === "rejected" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(businessApplications.id, applicationId), eq(businessApplications.status, current.status)))
      .returning();
    if (!updated) throw new BusinessApplicationConflictError("The application changed before this update completed.");

    if (status === "approved") {
      await ensureBusinessForApplication(updated, tx);
    }

    return updated;
  });
}
