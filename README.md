# MajiFlow

MajiFlow is a marketplace for ordering drinking water from independent refill
stations. Customers browse stations near them, build a cart with a per-station
delivery fee, check out, and track the delivery; stations get a storefront and a
dashboard to take orders, manage their catalogue and see their numbers.

Business identity and onboarding data is prepared for hosted Neon PostgreSQL.
Orders remain in the existing JSON store until a separate order migration is
planned.

## Features

### Customers
- Browse and search refill stations by city, estate or name.
- Station pages with products, prices, delivery fee, opening hours and live
  open/closed status.
- A cart that groups items by station and charges each station's own delivery
  fee and free-delivery minimum.
- Checkout with M-Pesa or card, a saved profile and delivery addresses, and
  optional live-location sharing for the rider.
- Order tracking from placed through accepted, out for delivery and delivered.

### Stations
- A dashboard with an overview, orders, products, customers, analytics,
  promotions, staff, billing and settings.
- Analytics computed from the station's own stored orders: revenue, repeat rate,
  best sellers and stock alerts.
- A public storefront page per station.

### Platform
- A control room listing every station, its plan, monthly fee and catalogue size.

## Tech stack

- **Next.js 16** (App Router, Turbopack) and **React 19**
- **TypeScript** in strict mode
- **Tailwind CSS v4** with design tokens in `src/app/globals.css`
- **framer-motion** for the hero and a few transitions
- **Leaflet** for the live order map (loaded on demand)
- **Vitest** for tests

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If `pnpm` is not on PATH,
use `corepack pnpm`. Do not commit `package-lock.json` (this repo uses pnpm).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint over `src` |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run Vitest in watch mode |

Release order (see `RELEASE.md`): typecheck → lint → test → build.

```bash
npx tsc --noEmit
npx eslint src
npx vitest run
npx next build
```

## Configuration

All variables are optional; without them the app runs and logs to stderr.

| Variable | Purpose |
| --- | --- |
| `MF_DATA_DIR` | Directory for `orders.json`. Defaults to `.data` in the repo. Point it at a mounted volume in production. |
| `MF_ALERT_WEBHOOK_URL` | Where order, payment, notification, store and geocode failures are POSTed. Without it, failures go to stderr only. |
| `MF_NOTIFY_WEBHOOK_URL` | Provider that sends order-status messages to customers. |
| `MF_ADMIN_KEY` | Signs admins in at `/admin` and authorizes admin APIs (refunds, linking an approved owner to a station via `POST /api/admin/applications/[id]/approve`). Without it, admin access is disabled. |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL used for metadata. Defaults to `http://localhost:3000`. |
| `DATABASE_URL` | Neon PostgreSQL connection string. Keep it in `.env.local` or your deployment provider's secret manager. |

### Neon database setup

1. Create a Neon project and database outside this repository.
2. Copy the connection string from Neon into a local `.env.local` file as
   `DATABASE_URL`. Do not use a `NEXT_PUBLIC_` prefix and do not commit the
   file or its value.
3. Generate migrations after schema changes with `pnpm db:generate`.
4. Apply committed migrations to the configured database with `pnpm db:migrate`.

The Drizzle CLI loads `DATABASE_URL` from `.env.local` when it is not already
set in the environment. The database client is server-only. Neon credentials
must be configured as server-side environment variables in deployment and
should be rotated through Neon and the hosting provider if exposed.

### Operations access

Operations access is not available through either public registration endpoint. An authorized
database operator provisions an operations account by first creating a normal account, then
running this targeted update against the intended account:

```sql
UPDATE users SET role = 'operations' WHERE email = '<verified-operations-email>';
```

The update must be performed through the approved database access process; never expose database
credentials to the browser or accept a role in a user-controlled request. The
`0002_add_operations_role` migration must be applied before provisioning.

### Local admin access

`/admin` is double-gated: the layout requires an `mf_admin` cookie (exchanged
from `MF_ADMIN_KEY`), and every admin page additionally requires a signed-in
`operations` account. The admin APIs accept the raw `MF_ADMIN_KEY` as a bearer
token instead, so server-to-server callers need neither cookie.

To enable the platform admin on a local machine:

1. Set `MF_ADMIN_KEY` in `.env.local` (generate one with `openssl rand -hex 32`).
2. Provision an `operations` account using the procedure above.
3. Visit `/admin`, enter the key, then sign in with the operations account.

The two cookies are established by:

```
POST /api/admin/session   # { "key": "<MF_ADMIN_KEY>" }  -> sets mf_admin
POST /api/auth/login      # { "email": "...", "password": "..." } -> sets mf_session
```

Both are required for the `/admin` pages. Without a valid `MF_ADMIN_KEY`, all
admin sessions fail closed and `/admin` stays behind the key prompt.

## Data

Orders are persisted as JSON in `MF_DATA_DIR` (default `.data/orders.json`).
Reads and writes are serialized through a single queue, and orders are validated
server-side (totals are recomputed, never trusted from the client). Tests point
`MF_DATA_DIR` at a fresh temporary directory so they never touch real orders.

## Project structure

```
src/
  app/                 routes (marketing, account, business shell, admin, api)
  components/          UI by area: home, shared, order, business, account, admin, ui
  lib/
    data/              seeded stations, plans and FAQs
    server/            database foundation and file-backed order store
    analytics.ts       station analytics (pure functions)
    business-hours.ts  opening hours and availability
    pricing.ts         cart totals
    orders.ts          client over the orders API
```

## Deploying

The app is stateless apart from the order file, so any Node host works:

1. Set `MF_DATA_DIR` to a persistent volume.
2. Set `MF_ALERT_WEBHOOK_URL` (and `MF_NOTIFY_WEBHOOK_URL` if you have a
   messaging provider) so failures and status changes are reported.
3. Build and run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Rolling back is a redeploy of the previous build; keep the data volume.

## PWA

MajiFlow ships a web app manifest (`src/app/manifest.ts`) and a service worker
(`public/sw.js`) so it can be installed to a phone home screen and keeps a light
offline fallback. The worker is registered in production builds only.

## Conventions

- Path alias `@/*` → `./src/*`.
- No em-dashes; JSX uses `&apos;` for apostrophes.
- Tests use `vi.useFakeTimers({ toFake: ["Date"] })` with `vi.setSystemTime`,
  because the order guard reads the wall clock.
- `AGENTS.md` is generated by `next dev`; do not hand-edit it.
