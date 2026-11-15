"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCustomer } from "@/components/order/customer-provider";
import { CITIES } from "@/lib/constants";
import { postLoginPath } from "@/lib/auth-navigation";

/** Form chrome shared by the input fields on the sign-in and sign-up pages. */
const inputClass = "h-12 rounded-md text-[15px] shadow-none";
const submitClass = "h-14 w-full rounded-lg text-base font-bold";

export function AuthShell({
  mode,
  children,
}: {
  mode: "login" | "register";
  /** Kept for the pages that pass it; the layout now carries the marketing copy. */
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-5">
      {children}

      <div className="flex items-center gap-3 text-[13px] text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Link
        href="/"
        className="flex h-13 w-full items-center justify-center rounded-lg border border-border bg-white text-[15px] font-bold text-foreground transition-colors hover:bg-surface-2"
      >
        Order without an account
      </Link>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to MajiFlow?{" "}
            <Link href="/register" className="font-bold text-[var(--brand)] hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[var(--brand)] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function RegisterForm() {
  const { toast } = useToast();
  const { login } = useCustomer();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", city: "Nairobi", estate: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create your account.");
      setSending(false);
      toast({
        kind: "success",
        title: "Profile saved",
        message: `${form.name.split(" ")[0] || "Karibu"} - your account is ready.`,
      });
      login({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        addresses: [{ label: "Home", estate: form.estate.trim(), city: form.city, phone: form.phone.trim() }],
      });
      router.push("/account");
    } catch (err) {
      setSending(false);
      setError(err instanceof Error ? err.message : "Could not create your account.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Order water, track deliveries and save your addresses - all from one account.
      </p>
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Full name" required>
          <Input
            className={inputClass}
            required
            placeholder="e.g. Amina Yusuf"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
          />
        </Field>
        <Field label="Phone number" required hint="Used for order updates and delivery calls.">
          <Input
            className={inputClass}
            required
            type="tel"
            placeholder="07XX XXX XXX"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            autoComplete="tel"
          />
        </Field>
        <Field label="Email" hint="For receipts and account recovery.">
          <Input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required hint="Use a secure password.">
          <div className="relative">
            <Input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
            </button>
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nearest town" required>
            <Select className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estate / area">
            <Input
            className={inputClass}
              placeholder="e.g. Kasarani, Milimani…"
              value={form.estate}
              onChange={(e) => setForm({ ...form, estate: e.target.value })}
            />
          </Field>
        </div>
        <Button type="submit" size="lg" className={submitClass} disabled={sending}>
          {sending ? "Creating your account…" : "Create account"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-[var(--brand)]">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-[var(--brand)]">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

export function LoginForm() {
  const { toast } = useToast();
  const { login } = useCustomer();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not sign in.");
      setSending(false);
      toast({ kind: "success", title: "Signed in", message: "Welcome back" });
      if (body.user?.role === "operations") {
  router.replace("/admin");
} else if (body.user?.role === "business_owner") {
  router.push(postLoginPath("business_owner"));
} else if (body.user?.role === "customer") {
  login({ name: body.user.name, email: body.user.email });
  router.push(postLoginPath("customer"));
} else {
  setError("Your account role could not be verified. Please contact support.");
}
    } catch (err) {
      setSending(false);
      setError(err instanceof Error ? err.message : "Could not sign in.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in with your email and password.
      </p>
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email" required>
          <Input
            className={inputClass}
            required
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required>
          <div className="relative">
            <Input
              required
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className={submitClass} disabled={sending}>
          {sending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm">
          <span className="text-muted-foreground">Trouble signing in? </span>
          <Link href="/contact" className="font-semibold text-[var(--brand)] hover:underline">
            Contact support
          </Link>
        </p>
      </form>
    </div>
  );
}