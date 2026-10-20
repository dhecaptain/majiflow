"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Droplets, Eye, EyeOff } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCustomer } from "@/components/order/customer-provider";
import { CITIES } from "@/lib/constants";
import { postLoginPath } from "@/lib/auth-navigation";

const perks = [
  "Browse verified stations around you",
  "See each station's delivery fee in the cart",
  "Follow an order from placed to delivered",
  "Save your details for one-tap checkout",
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[70vh] py-14 lg:py-20">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-white shadow-layered lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-white lg:flex">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-60" />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-transparent/25 blur-[100px]"
          />

          <div className="relative">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-transparent text-white shadow-accent">
              <Droplets className="size-6" aria-hidden />
            </span>
            <h2 className="mt-8 font-display text-3xl leading-[1.15] text-white">
              Clean water, delivered simply
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{subtitle}</p>
          </div>

          <ul className="relative space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-slate-200">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-7 sm:p-10">{children}</div>
      </div>

      {title.includes("Sign in") ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-semibold text-[#0052FF] hover:underline">
            Create an account
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0052FF] hover:underline">
            Sign in
          </Link>
        </p>
      )}
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
      <h1 className="font-display text-2xl text-foreground sm:text-3xl">Create your profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create an account to order water, track deliveries and manage your saved addresses.
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Full name" required>
          <Input
            required
            placeholder="e.g. Amina Yusuf"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
          />
        </Field>
        <Field label="Phone number" required hint="Used for order updates and delivery calls.">
          <Input
            required
            type="tel"
            placeholder="+254 7XX XXX XXX"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            autoComplete="tel"
          />
        </Field>
        <Field label="Email" hint="For receipts and account recovery.">
          <Input
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
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
            </button>
          </div>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nearest town" required>
            <Select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estate / area">
            <Input
              placeholder="e.g. Kasarani, Milimani…"
              value={form.estate}
              onChange={(e) => setForm({ ...form, estate: e.target.value })}
            />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? "Saving…" : "Save profile"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-[#0052FF]">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-[#0052FF]">
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
      <h1 className="font-display text-2xl text-foreground sm:text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in with the phone number and password you registered with.
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Email" required>
          <Input
            required
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required hint="Enter your password">
          <Input
            required
            type="password"
            placeholder="Your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="current-password"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm">
          <span className="text-muted-foreground">Forgot your password</span>
        </p>
      </form>
    </div>
  );
}