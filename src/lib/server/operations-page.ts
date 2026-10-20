import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError, requireOperations } from "@/lib/server/auth";

export async function requireOperationsPage() {
  try {
    return await requireOperations();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/");
    throw error;
  }
}
