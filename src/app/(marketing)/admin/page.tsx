import { connection } from "next/server";
import { AdminInsightsView } from "@/components/admin/admin-insights-view";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/feedback";
import { reportFailure } from "@/lib/monitoring";
import { getPlatformInsights, parseInsightRange } from "@/lib/server/admin-insights";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "Admin overview" };

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  await requireOperationsPage();
  await connection();
  const days = parseInsightRange((await searchParams).days);
  let insights: Awaited<ReturnType<typeof getPlatformInsights>>;
  try {
    insights = await getPlatformInsights(days);
  } catch (error) {
    await reportFailure("store", "Admin insights could not load.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return (
      <Container className="py-16">
        <ErrorState title="Insights could not load" message="The database did not answer. Refresh in a moment." />
      </Container>
    );
  }
  return <AdminInsightsView insights={insights} />;
}
