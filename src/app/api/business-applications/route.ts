import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import { createBusinessApplication, listOwnerApplications } from "@/lib/server/business-applications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await requireBusinessOwner();
    return Response.json({ applications: await listOwnerApplications(owner.id) });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Could not load applications." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  try {
    const owner = await requireBusinessOwner();
    const result = await createBusinessApplication(owner.id, body);
    if (!result.success) return Response.json({ error: "Please fix the highlighted fields.", fields: result.errors }, { status: 422 });
    return Response.json({ application: result.application }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 401 });
    return Response.json({ error: "Could not save your application." }, { status: 500 });
  }
}
