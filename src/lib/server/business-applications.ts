import { desc, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businessApplications } from "@/lib/server/db/schema";
import { validateBusinessApplication } from "@/lib/server/business-application-validation";

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
