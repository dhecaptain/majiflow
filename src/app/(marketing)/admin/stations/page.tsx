import { connection } from "next/server";
import { AdminStations } from "@/components/admin/admin-stations";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/feedback";
import { STATION_STATES, type StationState } from "@/lib/admin-console";
import { reportFailure } from "@/lib/monitoring";
import { listAdminStations, type AdminStation } from "@/lib/server/admin-insights";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "Stations" };

export default async function AdminStationsPage({ searchParams }: PageProps<"/admin/stations">) {
  await requireOperationsPage();
  await connection();
  const params = await searchParams;
  const requested = params.state;
  const query = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const initialState = STATION_STATES.includes(requested as StationState) ? (requested as StationState) : "all";

  let stations: AdminStation[];
  try {
    stations = await listAdminStations();
  } catch (error) {
    await reportFailure("store", "Admin station list could not load.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return (
      <Container className="py-16">
        <ErrorState title="Stations could not load" message="The database did not answer. Refresh in a moment." />
      </Container>
    );
  }
  return <AdminStations stations={stations} initialState={initialState} initialQuery={query} />;
}
