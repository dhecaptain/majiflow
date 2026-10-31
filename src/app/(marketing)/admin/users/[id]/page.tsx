import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { UserAccessToggle } from "@/components/admin/user-access-toggle";
import { Container } from "@/components/ui/container";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { ROLE_LABEL } from "@/lib/admin-console";
import { formatKES, formatPhone, formatRelativeTime } from "@/lib/format";
import { getAdminUser } from "@/lib/server/admin-insights";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "User" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const operator = await requireOperationsPage();
  await connection();
  const user = await getAdminUser((await params).id);
  if (!user) notFound();

  const stats = [
    { label: "Orders", value: user.orders.toLocaleString("en-KE") },
    { label: "Delivered value", value: formatKES(user.deliveredValue) },
    { label: "Last order", value: user.lastOrderAt ? formatRelativeTime(user.lastOrderAt) : "Never" },
    { label: "Joined", value: new Date(user.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) },
  ];

  return (
    <Container className="py-8 lg:py-10">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All users
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted font-display text-lg text-foreground">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl text-foreground">
              {user.name}
              {user.disabled && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 font-sans text-xs font-medium text-danger">Disabled</span>}
            </h1>
            <p className="text-sm text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {user.phone && (
                <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1.5 text-foreground hover:text-[var(--brand)]">
                  <Phone className="size-3.5" aria-hidden /> {formatPhone(user.phone)}
                </a>
              )}
              {user.email && (
                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 text-foreground hover:text-[var(--brand)]">
                  <Mail className="size-3.5" aria-hidden /> {user.email}
                </a>
              )}
            </div>
          </div>
        </div>
        {user.role !== "operations" && user.id !== operator.id && (
          <UserAccessToggle id={user.id} name={user.name} disabled={user.disabled} />
        )}
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-display text-xl text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>

      {user.ownedStations.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg text-foreground">Stations</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {user.ownedStations.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/stations?q=${encodeURIComponent(s.name)}`} className="inline-block rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/70">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <h2 className="border-b border-border px-5 py-4 font-display text-lg text-foreground">Recent orders</h2>
        {user.recentOrders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No orders on this account.</p>
        ) : (
          <ul className="divide-y divide-border">
            {user.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {o.orderNumber} <span className="font-normal text-muted-foreground">· {o.businessName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(o.placedAt)} · {o.payment === "cod" ? "Pay on delivery" : o.payment === "mpesa" ? "M-Pesa" : o.payment}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-foreground">{formatKES(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
