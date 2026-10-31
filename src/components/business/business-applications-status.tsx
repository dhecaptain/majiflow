"use client";

import Link from "next/link";
import * as React from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";

type ApplicationStatus = "submitted" | "under_review" | "approved" | "rejected";

interface Application {
  id: string;
  status: ApplicationStatus;
  rejectionReason: string | null;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  plan: string;
  submittedAt: string | null;
}

const statusLabels: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusVariants: Record<ApplicationStatus, BadgeProps["variant"]> = {
  submitted: "softAccent",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
};

export function BusinessApplicationsStatus() {
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/business-applications", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load applications.");
      setApplications(body.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (loading) return <LoadingState label="Loading your applications…" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load applications"
        message={error}
        action={
          error.includes("required") ? (
            <Link href="/login"><Button>Sign in</Button></Link>
          ) : (
            <Button onClick={() => void load()}><RefreshCw className="size-4" aria-hidden /> Try again</Button>
          )
        }
      />
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-6" aria-hidden />}
        title="No applications yet"
        description="Submit your business details to start your owner application."
        action={<Link href="/business/register"><Button>Start an application</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <article key={application.id} className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-foreground">{application.businessName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Submitted {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : "recently"}
              </p>
            </div>
            <Badge variant={statusVariants[application.status]}>{statusLabels[application.status]}</Badge>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Contact</dt><dd className="font-medium text-foreground">{application.ownerName} · {application.phone}</dd></div>
            <div><dt className="text-muted-foreground">Email</dt><dd className="font-medium text-foreground">{application.email}</dd></div>
            <div><dt className="text-muted-foreground">Location</dt><dd className="font-medium text-foreground">{application.address}, {application.city}</dd></div>
            <div><dt className="text-muted-foreground">Plan</dt><dd className="font-medium capitalize text-foreground">{application.plan}</dd></div>
          </dl>
          {application.status === "rejected" && application.rejectionReason && (
            <p className="mt-4 rounded-xl bg-brand/5 p-3 text-sm text-foreground">
              <span className="font-semibold">Reason: </span>{application.rejectionReason}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
