import { requireBusinessOwner } from "@/lib/server/auth";
import { revalidateStations } from "@/lib/server/catalog";
import {
  deleteStationProduct,
  parseCount,
  ProductValidationError,
  updateStationProduct,
  validateProductInput,
} from "@/lib/server/station-products";
import { productErrorResponse } from "@/lib/server/product-http";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * Change a product. A full form replaces it; `{ isVisible }` or `{ stock }`
 * alone are quick edits from the product list. Always scoped by `businessId`.
 */
export async function PATCH(request: Request, ctx: Context) {
  const { id } = await ctx.params;
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
    const quick = body.name === undefined;
    const change: Parameters<typeof updateStationProduct>[3] = {};
    if (quick) {
      if (body.isVisible !== undefined) {
        if (typeof body.isVisible !== "boolean") throw new ProductValidationError({ isVisible: "Choose shown or hidden." });
        change.isVisible = body.isVisible;
      }
      if (body.stock !== undefined) {
        const stock = parseCount(body.stock);
        if (stock === null) throw new ProductValidationError({ stock: "Stock must be a whole number." });
        change.stock = stock;
      }
      if (change.isVisible === undefined && change.stock === undefined) {
        return Response.json({ error: "Nothing to change." }, { status: 400 });
      }
    } else {
      change.input = validateProductInput(body);
    }
    const product = await updateStationProduct(businessId, owner.id, id, change);
    await revalidateStations();
    return Response.json({ product });
  } catch (error) {
    return productErrorResponse(error, "update the product");
  }
}

export async function DELETE(request: Request, ctx: Context) {
  const { id } = await ctx.params;
  const businessId = new URL(request.url).searchParams.get("businessId")?.trim() ?? "";
  if (!businessId) return Response.json({ error: "A station is required." }, { status: 400 });
  try {
    const owner = await requireBusinessOwner();
    await deleteStationProduct(businessId, owner.id, id);
    await revalidateStations();
    return new Response(null, { status: 204 });
  } catch (error) {
    return productErrorResponse(error, "remove the product");
  }
}
