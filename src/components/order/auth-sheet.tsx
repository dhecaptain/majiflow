"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useCustomer } from "@/components/order/customer-provider";
import { formatKenyanPhone, isKenyanMobile, normalizeKenyanPhone } from "@/lib/phone";

export interface AuthSheetUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful sign-in so the caller can continue the flow. */
  onSignedIn?: (user: AuthSheetUser) => void;
  /** Why the sheet opened; changes the headline. */
  intent?: "order" | "account";
}

type Step = "details" | "code";

const CODE_LENGTH = 6;

export function AuthSheet({ open, onClose, onSignedIn, intent = "order" }: AuthSheetProps) {
  const { toast } = useToast();
  const { login } = useCustomer();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [accountType, setAccountType] = useState<"new" | "registered" | null>(null);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{ phone?: string; code?: string; name?: string }>({});
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const requestCode = useCallback(
    async (targetPhone: string) => {
      setSending(true);
      setError("");
      setFieldError({});
      try {
        const response = await fetch("/api/auth/otp/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: targetPhone }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = body.error ?? "We could not send the code. Please try again.";
          setError(message);
          if (body.fields?.phone) setFieldError({ phone: body.fields.phone });
          return false;
        }
        setAccountType(body.status === "registered" ? "registered" : "new");
        setResendIn(Number(body.resendAfterSeconds ?? 60));
        setStep("code");
        window.setTimeout(() => codeRef.current?.focus(), 80);
        if (body.devCode) {
          // Development only: the dev provider hands the code back so the flow
          // can be walked through without an SMS account.
          setCode(body.devCode);
        }
        return true;
      } catch {
        setError("We could not send the code. Check your connection and try again.");
        return false;
      } finally {
        setSending(false);
      }
    },
    []
  );

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldError({});
    const local = normalizeKenyanPhone(phone);
    if (!isKenyanMobile(phone)) {
      setFieldError({ phone: "Use a Kenyan mobile number, e.g. 07XX XXX XXX or +254 7XX…." });
      return;
    }
    if (name.trim().length < 2) {
      setFieldError({ name: "Enter your full name." });
      return;
    }
    await requestCode(local!);
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldError({});
    if (code.trim().length !== CODE_LENGTH) {
      setFieldError({ code: `Enter the ${CODE_LENGTH} digits we sent you.` });
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), name: name.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "That code is not right. Try again.");
        if (body.code === "expired" || body.code === "attempts") {
          setResendIn(0);
        }
        return;
      }
      const user: AuthSheetUser = {
        id: body.user?.id ?? "",
        name: body.user?.name ?? name.trim(),
        email: body.user?.email ?? null,
        phone: body.user?.phone ?? phone.trim(),
        role: body.user?.role ?? "customer",
      };
      toast({
        kind: "success",
        title: accountType === "registered" ? "Welcome back" : "Account ready",
        message: accountType === "registered" ? "You are signed in." : "Your account is ready.",
      });
      login({
        name: user.name,
        phone: user.phone ?? phone.trim(),
        ...(user.email ? { email: user.email } : {}),
      });
      onClose();
      onSignedIn?.(user);
    } catch {
      setError("We could not sign you in. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const title =
    step === "code"
      ? accountType === "registered"
        ? "Welcome back"
        : "Enter your code"
      : intent === "order"
        ? "Start your order"
        : "Create your account";

  const subtitle =
    step === "code"
      ? `We sent a ${CODE_LENGTH}-digit code to ${formatKenyanPhone(phone)}.`
      : "Sign up with your Kenyan phone number. No password to remember.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={subtitle}
      className="sm:max-w-md"
    >
      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        {step === "details" ? (
          <form onSubmit={submitDetails} className="space-y-4" noValidate>
            <Field label="Full name" required error={fieldError.name}>
              <Input
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amina Yusuf"
                autoComplete="name"
                invalid={Boolean(fieldError.name)}
              />
            </Field>
            <Field
              label="Phone number"
              required
              error={fieldError.phone}
              hint="We text you a one-time code. Standard rates apply."
            >
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                autoComplete="tel"
                invalid={Boolean(fieldError.phone)}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={sending}>
              Send my code
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4" noValidate>
            <Field label={`${CODE_LENGTH}-digit code`} required error={fieldError.code}>
              <Input
                ref={codeRef}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.4em]"
                invalid={Boolean(fieldError.code)}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={verifying}>
              {accountType === "registered" ? "Sign in" : "Create my account"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setCode("");
                  setError("");
                  setFieldError({});
                }}
                className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Change number
              </button>
              <button
                type="button"
                onClick={() => requestCode(normalizeKenyanPhone(phone) ?? phone.trim())}
                disabled={resendIn > 0 || sending}
                className="font-medium text-[var(--brand)] disabled:text-muted-foreground disabled:opacity-70"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
            We only use your number for sign-in codes and order updates. You can change how we contact you
            in your account.
          </p>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
            Prefer your old sign-in?{" "}
            <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
              Use email and password
            </Link>
          </p>
        </div>
      </div>
    </Dialog>
  );
}
