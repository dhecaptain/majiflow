import { authorizeOperationsRequest } from "@/lib/server/operations-authorization";
import { listAllBusinessApplications } from "@/lib/server/business-applications";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeOperationsRequest();
  if (authorization.response) return authorization.response;
  try {
    return Response.json({ applications: await listAllBusinessApplications() });
  } catch {
    return Response.json({ error: "Could not load business applications." }, { status: 500 });
  }
}
