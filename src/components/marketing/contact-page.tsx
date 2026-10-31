"use client";

import { useState } from "react";
import { Clock, Inbox, Mail, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/shared/page-hero";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const topics = [
  "I want to order water",
  "I run a refill business - register me",
  "Billing or subscription help",
  "Support for an existing order",
  "Press or partnership",
  "Something else",
];

const notes = [
  {
    icon: Mail,
    label: "Email us",
    text: "Reach us at support@majiflow.co.ke. We reply within one business day.",
  },
  {
    icon: Inbox,
    label: "Order help",
    text: "Resolve delivery issues fastest from the order page, where you can contact the station.",
  },
  {
    icon: ShieldCheck,
    label: "Station support",
    text: "Refill businesses get priority help with listings and payments.",
  },
];

export function ContactPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: topics[0], message: "" });

  const [sending, setSending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** The visitor's own email app, used when the site cannot send messages. */
  const openEmailApp = () => {
    const subject = encodeURIComponent(`[${form.topic}] Enquiry from ${form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\n\n${form.message}`
    );
    window.location.href = `mailto:support@majiflow.co.ke?subject=${subject}&body=${body}`;
    toast({
      kind: "info",
      title: "Opening your email app",
      message: "Your message is drafted - press send in your email app and we will reply within one business day.",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFieldErrors({});
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (response.ok) {
        toast({ kind: "success", title: "Message sent", message: "Thanks - we reply within one business day." });
        setForm((current) => ({ ...current, message: "" }));
      } else if (response.status === 422) {
        setFieldErrors(result.fields ?? {});
        toast({ kind: "error", title: "Check the form", message: result.error ?? "Please fix the highlighted fields." });
      } else if (response.status === 429) {
        toast({ kind: "error", title: "Please wait a moment", message: result.error ?? "Too many messages - try again shortly." });
      } else {
        openEmailApp();
      }
    } catch {
      openEmailApp();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHero
        label="Contact"
        pulseLabel
        title={
          <>
            Questions about an order? <span className="text-gradient">We are here to help.</span>
          </>
        }
        description="Send us a message and our support team will get back to you within one business day."
      />

      <section className="py-16 lg:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="font-display text-2xl text-foreground">How to reach us</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Use the form for anything account, billing or partnership related, or pick the
                channel below that fits your question.
              </p>
              <div className="mt-8 flex flex-col gap-4">
                {notes.map((n) => (
                  <div key={n.label} className="flex items-start gap-3.5 rounded-2xl border border-border bg-white p-5 shadow-card">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)] shadow-accent">
                      <n.icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{n.label}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{n.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Support hours: Monday to Saturday, 7am - 7pm EAT.
              </p>
            </div>

            <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-border bg-white p-6 shadow-layered sm:p-8" aria-label="Contact form">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your name" required error={fieldErrors.name}>
                  <Input
                    required
                    placeholder="e.g. Amani Otieno"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Phone number" required hint="We only use this to discuss your enquiry.">
                  <Input
                    required
                    type="tel"
                    placeholder="+254 7XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Email" required error={fieldErrors.email}>
                    <Input
                      required
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      autoComplete="email"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="What's this about?" required>
                    <Select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                      {topics.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Message" required error={fieldErrors.message}>
                    <Textarea
                      required
                      rows={5}
                      placeholder="Tell us what's happening…"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
              <Button type="submit" size="lg" className="mt-6 w-full group" disabled={sending} loading={sending}>
                Email us
              </Button>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                We only use your details to answer your enquiry and never share them.
              </p>
            </form>
          </div>
        </Container>
      </section>
    </>
  );
}
