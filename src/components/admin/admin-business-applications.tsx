"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";

type Status = "submitted" | "under_review" | "approved" | "rejected";
type Application = {
  id: string;
  status: Status;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  plan: string;
  description: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
};

const labels: Record<Status, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};
const variants: Record<Status, BadgeProps["variant"]> = {
  submitted: "softAccent",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
};

export function AdminBusinessApplications() {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Could not load applications");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    setErrorTitle("Could not load applications");
    try {
      const response = await fetch("/api/admin/business-applications", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load applications.");
      setApplications(body.applications ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load applications.");
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function update(application: Application, status: Status, rejectionReason?: string) {
    if (status === "rejected" && !rejectionReason?.trim()) {
      setErrorTitle("Could not update application");
      setError("A rejection reason is required.");
      setNotice(null);
      return;
    }
    setBusyId(application.id);
    setError(null);
    setErrorTitle("Could not update application");
    setNotice(null);
    try {
      const approving = status === "approved";
      const response = await fetch(
        approving
          ? `/api/admin/applications/${application.id}/approve`
          : `/api/admin/business-applications/${application.id}`,
        {
        method: approving ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(approving ? {} : { status, ...(status === "rejected" ? { rejectionReason } : {}) }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not update application.");
      setApplications((current) => current?.map((item) => item.id === application.id ? body.application : item) ?? current);
      setNotice(`${application.businessName} marked ${labels[status].toLowerCase()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update application.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Container className="py-10 lg:py-14">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--brand)]">Operations</p>
        <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Business applications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review submitted applications and record the decision.</p>
      </div>
      {notice && <p role="status" className="mt-6 rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">{notice}</p>}
      {error && <div className="mt-6"><ErrorState title={errorTitle} message={error} action={<Button onClick={() => void load()}><RefreshCw className="size-4" aria-hidden /> Try again</Button>} /></div>}
      {!error && applications === null && <LoadingState label="Loading applications…" />}
      {!error && applications?.length === 0 && <EmptyState className="mt-8" icon={<ClipboardCheck className="size-6" aria-hidden />} title="No applications yet" description="Submitted applications will appear here." />}
      {!error && applications && applications.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <ul className="divide-y divide-border">
            {applications.map((application) => {
              const updating = busyId === application.id;
              return (
                <li key={application.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl text-foreground">{application.businessName}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{application.ownerName} · {application.email} · {application.city}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Submitted {application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "recently"}</p>
                    </div>
                    <Badge variant={variants[application.status]}>{labels[application.status]}</Badge>
                  </div>
                  <p className="mt-4 text-sm text-foreground">{application.address} · {application.phone} · <span className="capitalize">{application.plan}</span></p>
                  {application.description && <p className="mt-2 text-sm text-muted-foreground">{application.description}</p>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {application.status === "submitted" && <Button size="sm" variant="outline" disabled={updating} onClick={() => void update(application, "under_review")}>Start review</Button>}
                    {application.status === "under_review" && (
                      <>
                        <label className="basis-full text-sm font-medium text-foreground" htmlFor={`rejection-reason-${application.id}`}>
                          Rejection reason
                          <textarea
                            id={`rejection-reason-${application.id}`}
                            value={rejectionReasons[application.id] ?? ""}
                            onChange={(event) => setRejectionReasons((current) => ({ ...current, [application.id]: event.target.value }))}
                            disabled={updating}
                            maxLength={2000}
                            rows={2}
                            placeholder="Explain why this application is being rejected"
                            className="mt-1 block w-full rounded-xl border border-border px-3 py-2 text-sm font-normal outline-none focus:border-[var(--brand)]"
                          />
                        </label>
                        <Button size="sm" disabled={updating} onClick={() => void update(application, "approved")}>Approve</Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={updating}
                          onClick={() => void update(application, "rejected", rejectionReasons[application.id])}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Container>
  );
}
