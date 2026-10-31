import { requireBusinessOwner } from "@/lib/server/auth";
import { revalidateStations } from "@/lib/server/catalog";
import { productErrorResponse } from "@/lib/server/product-http";
import { createStationProduct, listStationProducts, validateProductInput } from "@/lib/server/station-products";

export const dynamic = "force-dynamic";

/** The owner's products for one of their stations, hidden ones included. */
export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")?.trim() ?? "";
  if (!businessId) return Response.json({ error: "A station is required." }, { status: 400 });
  try {
    const owner = await requireBusinessOwner();
    return Response.json({ products: await listStationProducts(businessId, owner.id) });
  } catch (error) {
    return productErrorResponse(error, "load your products");
  }
}

/** Add a product: { businessId, ...product }. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return Response.json({ error: "A station is required." }, { status: 400 });
  try {
    const owner = await requireBusinessOwner();
    const product = await createStationProduct(businessId, owner.id, validateProductInput(body));
    await revalidateStations();
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return productErrorResponse(error, "add the product");
  }
}
