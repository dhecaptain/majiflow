import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businessApplications, businesses as businessRows, users } from "@/lib/server/db/schema";
import { businesses as catalog } from "@/lib/data/businesses";

/**
 * Tenant mapping. A business owner manages a catalog station once the
 * platform approves their application and links it: the `businesses` row
 * carries the station's slug, which is also the catalog station id orders
 * are stamped with. Owners never pick their station from the client.
 */

export async function listOwnerStationIds(ownerUserId: string): Promise<string[]> {
  const { db } = await getDatabase();
  const rows = await db
    .select({ slug: businessRows.slug })
    .from(businessRows)
    .where(eq(businessRows.ownerUserId, ownerUserId));
  const slugs = new Set(rows.map((row) => row.slug));
  return catalog.filter((station) => slugs.has(station.slug)).map((station) => station.id);
}

export class StationLinkError extends Error {
  constructor(message: string, readonly status: 404 | 409 | 422) {
    super(message);
  }
}

/** Approve an owner application and link it to a catalog station (platform admin only). */
export async function approveApplicationForStation(applicationId: string, stationSlug: string) {
  const station = catalog.find((candidate) => candidate.slug === stationSlug);
  if (!station) throw new StationLinkError("Unknown station.", 422);
  const { db } = await getDatabase();
  return db.transaction(async (tx) => {
    const [application] = await tx
      .select()
      .from(businessApplications)
      .where(eq(businessApplications.id, applicationId))
      .limit(1);
    if (!application) throw new StationLinkError("Application not found.", 404);
    if (application.status === "rejected") throw new StationLinkError("This application was rejected.", 409);
    const [owner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, application.ownerUserId), eq(users.role, "business_owner")))
      .limit(1);
    if (!owner) throw new StationLinkError("The applicant is not a business owner account.", 409);
    const [linked] = await tx
      .select()
      .from(businessRows)
      .where(eq(businessRows.applicationId, application.id))
      .limit(1);
    if (linked && linked.slug !== station.slug) {
      throw new StationLinkError("This application is already linked to another station.", 409);
    }
    let business = linked;
    if (!business) {
      const [taken] = await tx
        .select({ id: businessRows.id })
        .from(businessRows)
        .where(eq(businessRows.slug, station.slug))
        .limit(1);
      if (taken) throw new StationLinkError("That station is already managed by another owner.", 409);
      [business] = await tx
        .insert(businessRows)
        .values({
          ownerUserId: application.ownerUserId,
          applicationId: application.id,
          slug: station.slug,
          name: station.name,
          isComplete: true,
          isPublished: true,
        })
        .returning();
    }
    await tx
      .update(businessApplications)
      .set({ status: "approved", completedAt: new Date(), rejectionReason: null })
      .where(eq(businessApplications.id, application.id));
    return { business, stationId: station.id };
  });
}
