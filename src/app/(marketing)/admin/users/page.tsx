import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight, Download, Search } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ROLE_LABEL, type AdminUserRole } from "@/lib/admin-console";
import { formatKES, formatPhone, formatRelativeTime } from "@/lib/format";
import { reportFailure } from "@/lib/monitoring";
import { listAdminUsers, USERS_PAGE_SIZE } from "@/lib/server/admin-insights";
import { requireOperationsPage } from "@/lib/server/operations-page";
import { cn } from "@/lib/utils";

export const metadata = { title: "Users" };

const ROLES: ("all" | AdminUserRole)[] = ["all", "customer", "business_owner", "operations"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(params: { q?: string; role?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.role && params.role !== "all") search.set("role", params.role);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireOperationsPage();
  await connection();
  const params = await searchParams;
  const q = one(params.q)?.trim() ?? "";
  const roleParam = one(params.role);
  const role = ROLES.includes(roleParam as AdminUserRole) ? (roleParam as AdminUserRole) : "all";
  const page = Math.max(1, Number(one(params.page)) || 1);

  let result: Awaited<ReturnType<typeof listAdminUsers>>;
  try {
    result = await listAdminUsers({ q, role, page });
  } catch (error) {
    await reportFailure("store", "Admin user list could not load.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return (
      <Container className="py-16">
        <ErrorState title="Users could not load" message="The database did not answer. Refresh in a moment." />
      </Container>
    );
  }
  const pages = Math.max(1, Math.ceil(result.total / USERS_PAGE_SIZE));

  return (
    <Container className="py-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer and station-owner accounts. Guests who ordered without an account are not listed.
          </p>
        </div>
        <a href="/api/admin/export?kind=users" className={buttonVariants({ variant: "secondary", size: "sm", className: "gap-2" })}>
          <Download className="size-4" aria-hidden /> Users CSV
        </a>
      </div>

      <form action="/admin/users" className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:max-w-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search users</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, email or phone"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        {role !== "all" && <input type="hidden" name="role" value={role} />}
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
      </form>

      <nav aria-label="Filter by role" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {ROLES.map((r) => (
          <Link
            key={r}
            href={href({ q, role: r })}
            aria-current={r === role ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors",
              r === role
                ? "border-[var(--brand)] bg-brand/10 text-[var(--brand)]"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {r === "all" ? "All" : ROLE_LABEL[r]}
          </Link>
        ))}
      </nav>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {result.users.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={q || role !== "all" ? "No users match" : "No accounts yet"}
              description={q || role !== "all" ? "Try another search or role." : "Accounts appear here as people sign up."}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {result.users.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground">
                    {u.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      <span className="truncate">{u.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{ROLE_LABEL[u.role]}</span>
                      {u.disabled && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Disabled</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[u.phone ? formatPhone(u.phone) : null, u.email].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    {u.role === "business_owner" ? (
                      <p><span className="font-mono text-foreground">{u.stations}</span> station{u.stations === 1 ? "" : "s"}</p>
                    ) : (
                      <p>
                        <span className="font-mono text-foreground">{u.orders}</span> order{u.orders === 1 ? "" : "s"}
                        {u.deliveredValue > 0 && <> · {formatKES(u.deliveredValue)}</>}
                      </p>
                    )}
                    <p>Joined {formatRelativeTime(u.createdAt)}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {result.page} of {pages} · {result.total.toLocaleString("en-KE")} accounts
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link href={href({ q, role, page: result.page - 1 })} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Previous
              </Link>
            )}
            {result.page < pages && (
              <Link href={href({ q, role, page: result.page + 1 })} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </Container>
  );
}
