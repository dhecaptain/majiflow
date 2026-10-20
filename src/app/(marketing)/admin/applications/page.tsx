import { AdminBusinessApplications } from "@/components/admin/admin-business-applications";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "Business applications" };

export default async function AdminApplicationsPage() {
  await requireOperationsPage();
  return <AdminBusinessApplications />;
}
