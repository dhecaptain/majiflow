"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Disable or restore one account, with a confirmation step. */
export function UserAccessToggle({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !disabled }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not update the account.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={disabled ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
        className={disabled ? undefined : "text-danger hover:bg-danger-soft"}
      >
        {disabled ? "Restore account" : "Disable account"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={disabled ? `Restore ${name}?` : `Disable ${name}?`}
        description={
          disabled
            ? "They can sign in again straight away."
            : "They are signed out everywhere and cannot sign in. Their orders and stations are kept."
        }
      >
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            data-autofocus
            onClick={() => void submit()}
            disabled={busy}
            className={disabled ? undefined : "bg-danger text-white hover:bg-danger/90"}
          >
            {busy ? "Saving…" : disabled ? "Restore" : "Disable"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
