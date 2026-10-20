"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AdminSignIn() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) {
      setError("Enter the operator key.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "That key was not accepted.");
        return;
      }
      setKey("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8"
      aria-labelledby="admin-signin-heading"
      noValidate
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-[#0052FF]">
        <LockKeyhole className="size-6" aria-hidden />
      </span>
      <h1 id="admin-signin-heading" className="mt-4 font-display text-2xl text-foreground">
        Platform admin
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in with the MajiFlow operator key.</p>
      <Field label="Operator key" required error={error ?? undefined} className="mt-6">
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="current-password"
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      setBusy(false);
      router.refresh();
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut()} disabled={busy} className="gap-2">
      <LogOut className="size-4" aria-hidden /> Sign out of admin
    </Button>
  );
}
