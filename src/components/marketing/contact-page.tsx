"use client";

import { useState } from "react";
import { Clock, Inbox, Mail, ShieldCheck } from "lucide-react";
import { PageHero, PageSection } from "@/components/shared/page-hero";
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
        title="How can we help?"
        description="Send us a message and our support team replies within one business day."
      />

      <PageSection className="!pt-6 lg:!pt-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
            <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-border bg-white p-5 sm:p-7" aria-label="Contact form">
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
                    placeholder="07XX XXX XXX"
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
              <Button type="submit" size="lg" className="mt-6 h-13 w-full rounded-lg text-base font-bold" disabled={sending} loading={sending}>
                Send message
              </Button>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                Your information is used only to respond to your enquiry and is handled securely in line with our Privacy Policy.
              </p>
            </form>

            <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Other ways to reach us</h2>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-white">
                {notes.map((n) => (
                  <div key={n.label} className="flex items-start gap-3.5 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[var(--brand)]">
                      <n.icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{n.label}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{n.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Clock className="size-4 shrink-0" aria-hidden />
                Support hours: Monday to Saturday, 7am to 7pm EAT.
              </p>
            </aside>
          </div>
      </PageSection>
    </>
  );
}
