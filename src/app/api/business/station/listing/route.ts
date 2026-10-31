import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import { revalidateStations } from "@/lib/server/catalog";
import {
  completeBusinessListing,
  ListingIncompleteError,
  StationNotFoundError,
  StationPublicationError,
  StationUnauthorizedError,
  type ListingUpdates,
} from "@/lib/server/station-publication";

export const dynamic = "force-dynamic";

type FieldResult = { value?: string | number | null; error?: string };

function readText(value: unknown, field: string): FieldResult {
  if (typeof value !== "string") return { error: `${field} is invalid.` };
  return { value };
}

function readNumberLike(value: unknown, field: string): FieldResult {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value } : { error: `${field} is invalid.` };
  }
  if (typeof value === "string") return { value };
  return { error: `${field} is invalid.` };
}

function readCoordinate(value: unknown, field: string): FieldResult {
  if (value === null || value === "") return { value: null };
  return readNumberLike(value, field);
}

/**
 * Saves the owner's listing fields and completes the listing only when the
 * server-side completeness validation passes. Clients cannot set isComplete.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const businessId = typeof payload.businessId === "string" ? payload.businessId.trim() : "";
  if (!businessId) {
    return Response.json({ error: "A business is required." }, { status: 400 });
  }

  const updates: ListingUpdates = {};
  const fields: Array<[keyof ListingUpdates, FieldResult]> = [];

  if (payload.businessName !== undefined) {
    fields.push(["businessName", readText(payload.businessName, "Business name")]);
  }
  if (payload.description !== undefined) {
    fields.push(["description", readText(payload.description, "Description")]);
  }
  if (payload.zones !== undefined) {
    fields.push(["zones", readText(payload.zones, "Delivery areas")]);
  }
  if (payload.deliveryFee !== undefined) {
    fields.push(["deliveryFee", readNumberLike(payload.deliveryFee, "Delivery fee")]);
  }
  if (payload.deliveryTimeMinutes !== undefined) {
    fields.push(["deliveryTimeMinutes", readNumberLike(payload.deliveryTimeMinutes, "Delivery time")]);
  }
  if (payload.latitude !== undefined) {
    fields.push(["latitude", readCoordinate(payload.latitude, "Latitude")]);
  }
  if (payload.longitude !== undefined) {
    fields.push(["longitude", readCoordinate(payload.longitude, "Longitude")]);
  }
  if (payload.freeDeliveryAbove !== undefined) {
    fields.push(["freeDeliveryAbove", readNumberLike(payload.freeDeliveryAbove, "Free delivery threshold")]);
  }
  if (payload.openingHours !== undefined) {
    if (!payload.openingHours || typeof payload.openingHours !== "object") {
      return Response.json({ error: "Opening hours are invalid." }, { status: 400 });
    }
    updates.openingHours = payload.openingHours;
  }

  for (const [key, field] of fields) {
    if (field.error) {
      return Response.json({ error: field.error }, { status: 400 });
    }
    Object.assign(updates, { [key]: field.value });
  }

  try {
    const owner = await requireBusinessOwner();
    const business = await completeBusinessListing(
      businessId,
      owner.id,
      Object.keys(updates).length > 0 ? updates : undefined
    );
    await revalidateStations();
    return Response.json({ business });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof StationNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StationUnauthorizedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ListingIncompleteError) {
      return Response.json(
        { error: error.message, missingFields: error.missingFields },
        { status: 422 }
      );
    }
    if (error instanceof StationPublicationError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json({ error: "Could not complete your listing." }, { status: 500 });
  }
}
