# FarmCircle API

NestJS backend for FarmCircle, a single-grower produce marketplace connecting a grower's operation to business buyers (Vendors) and individual customers (Customers). See the [root README](../README.md) for the project overview and [`docs/`](../docs/) for the full product spec.

## Stack

- **NestJS** — application framework
- **PostgreSQL + Prisma** — the transactional core: users, crop/cycle/batch structure, listings, orders, pre-bookings, payments, reviews. Prisma 7 with a driver adapter (`@prisma/adapter-pg`), custom client output at `generated/prisma` (not the default `node_modules/@prisma/client` location)
- **MongoDB + Mongoose** *(not yet added)* — variable-shape/append-only content: listing media/descriptions, batch activity logs, order status history
- **Redis** *(not yet added)* — pre-booking capacity counters and payment-hold TTLs
- **JWT + Google OAuth** — authentication
- **Razorpay** (test mode) — payments

## Getting started

The stack runs via Docker Compose from the repo root (see the [root README](../README.md#getting-started) for the `.env` setup and `docker compose up` step). From inside the running container, or in this directory if you have Node 22 and a local Postgres instance:

```bash
npm install
npm run start:dev        # watch mode, http://localhost:3000
```

### Database

Prisma commands need to run against a reachable Postgres instance. `postgres` as a hostname only resolves inside the Docker network the containers share, so run these through Compose rather than directly on the host:

```bash
docker compose run --rm api npx prisma migrate dev --name <migration-name>
docker compose run --rm api npx prisma generate
docker compose run --rm api npx prisma studio
```

## Scripts

```bash
npm run start:dev        # watch mode
npm run start:debug      # watch mode + debugger
npm run build            # nest build
npm run lint             # eslint --fix over src/apps/libs/test
npm run format           # prettier --write src/test

npm run test             # jest unit tests (*.spec.ts, colocated with source)
npm run test:watch
npm run test:cov
npm run test:e2e         # jest -c test/jest-e2e.json (test/*.e2e-spec.ts)
npx jest src/path/to/file.spec.ts   # single unit test file
```

## Architecture

One NestJS module per owned entity/data concern (`AuthModule`, `UsersModule`, `CatalogModule`, `CycleModule`, `BatchModule`, `InventoryModule`, `OrderModule`, `PreBookingModule`, `PaymentModule`, `ReviewModule`) — role-based access is enforced with `@Roles()` + `RolesGuard` inside the module that owns the relevant data, rather than a module per role.

Two structural patterns run through the core domain model (`prisma/schema.prisma`):

1. **Template vs. instance** — `Cycle` + `Milestone` are grower-defined templates (ordered milestone sequences per crop). A `Batch` is an instance: creating one snapshots the cycle's milestones into `BatchMilestoneProgress` rows, so editing a `Cycle` later never retroactively changes an in-progress `Batch`.
2. **Two paths to a `Listing`** — *tracked* (`Crop → Cycle → Batch → Listing`, auto-drafted when a batch hits its final milestone) vs. *direct* (`Crop → Listing`, for onboarding existing stock without cycle tracking).

Business rules enforced at the service layer (not by Prisma itself) include price snapshotting at listing creation, a wholesale-to-retail pricing fallback below the minimum wholesale quantity, a per-listing retail order ceiling, and a pre-booking lifecycle (`QUEUED → AWAITING_PAYMENT → CONFIRMED/EXPIRED/CANCELLED`) with a 48-hour payment hold mirrored in Redis.

## Auth

`AuthModule` currently implements:

- `POST /auth/register` — email/password registration (Vendor/Customer roles)
- `POST /auth/login` — validates credentials, returns a signed JWT access token in the response body, and sets a signed refresh token as an httpOnly cookie. A hashed copy of the refresh token is persisted (`RefreshToken` table) so it can be looked up and revoked later without ever storing the usable token itself.

`POST /auth/refresh`, `POST /auth/logout`, and route-level JWT verification (`JwtAuthGuard`) are not yet implemented.

## Testing

Business logic (pricing/eligibility calculations, order/pre-booking state transitions, auth guards) is covered with strict unit tests written before the implementation; third-party integration glue (Razorpay webhooks, OAuth callbacks) gets lighter after-the-fact coverage.

## License

[MIT](../LICENSE)
