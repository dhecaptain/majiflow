import { BusinessApplicationsStatus } from "@/components/business/business-applications-status";

export const metadata = { title: "Applications" };

export default function BusinessApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0052FF]">Owner account</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Business applications</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track the review status of applications submitted from your account.
        </p>
      </div>
      <BusinessApplicationsStatus />
    </div>
  );
}
