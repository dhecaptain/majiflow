import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import { listOwnerStations } from "@/lib/server/owner-stations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await requireBusinessOwner();
    return Response.json({ stations: await listOwnerStations(owner.id) });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return Response.json({ error: "Could not load your stations." }, { status: 500 });
  }
}
