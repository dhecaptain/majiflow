import { AccountShell } from "@/components/account/account-shell";
import { AuthenticationError, requireCustomer } from "@/lib/server/auth";
import { redirect } from "next/navigation";

/** Private pages: never indexed. */
export const metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireCustomer();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    throw error;
  }
  return <AccountShell>{children}</AccountShell>;
}