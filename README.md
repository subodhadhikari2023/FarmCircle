# FarmCircle

A single-grower produce marketplace — one business managing crop production and inventory, selling to business buyers (Vendors) and individual customers (Customers), with an Admin role for platform moderation.

[![CI](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## About

FarmCircle connects a single grower's operation directly to its buyers — Vendors (B2B, wholesale) and Customers (B2C, retail) — replacing the manual, ad hoc process of tracking crops, harvest timing, and orders with a proper system built around the real lifecycle of the business.

It models the domain with real business rules: growth-cycle tracking from planting to harvest, wholesale vs. retail pricing with per-listing bounds, a pre-booking system for future yield with payment holds and expiry, and post-fulfillment grower reviews. Infrastructure is built the way a production system would be — Docker Compose for local orchestration, a CI pipeline enforcing lint/tests on every PR — rather than leaning on managed services that paper over those decisions.

## Project status

Early scaffolding. Only the [`api/`](api/) NestJS backend exists so far — the `AuthModule` (registration, login, JWT access/refresh tokens) is implemented and tested; the rest of the domain modules described in [`docs/`](docs/) are not yet built. The Next.js frontend has not been started.

## Tech stack

| Concern | Choice |
|---|---|
| Frontend | Next.js (not yet started) |
| Backend | NestJS |
| Relational data | PostgreSQL + Prisma (users, crops/cycles/batches, listings, orders, pre-bookings, payments, reviews — anything needing strict relationships and ACID correctness) |
| Variable-shape data | MongoDB + Mongoose (listing media/descriptions, batch activity logs, order status history — not yet added) |
| Ephemeral state | Redis (pre-booking capacity counters, payment-hold TTLs — not yet added) |
| Auth | JWT (access + refresh) + Google OAuth |
| Payments | Razorpay (test mode) |
| Infra | Docker Compose (local dev), GitHub Actions (CI) |

## Repo layout

```
api/            NestJS backend (the only app that currently exists) — see api/README.md
docs/           Product/architecture specs (requirements, API design, schema design)
docker-compose.yml   postgres + mongo + redis + api, for local dev
```

## Documentation

The full product spec lives in [`docs/`](docs/):

- [`FarmCircle-Requirements.md`](docs/FarmCircle-Requirements.md) — roles, business rules, module list
- [`FarmCircle-API-Design.md`](docs/FarmCircle-API-Design.md) — endpoint-by-endpoint REST design with access rules and status codes
- [`FarmCircle-Schema-Design.md`](docs/FarmCircle-Schema-Design.md) — Postgres/Mongo/Redis schema rationale

## Getting started

Requires Docker and Docker Compose.

1. Create a `.env` file in the repo root with:
   ```
   POSTGRES_USER=...
   POSTGRES_PASSWORD=...
   POSTGRES_DB=...
   DATABASE_URL=postgresql://<user>:<password>@postgres:5432/<db>
   MONGO_URL=mongodb://mongo:27017
   REDIS_URL=redis://redis:6379
   JWT_ACCESS_SECRET=...
   JWT_ACCESS_TTL_SECONDS=900
   JWT_REFRESH_SECRET=...
   JWT_REFRESH_TTL_SECONDS=604800
   ```
2. Bring up the stack:
   ```bash
   docker compose up -d --build
   ```
   This starts Postgres, Mongo, Redis, and the API (`http://localhost:3000`) in watch mode.
3. Apply database migrations (see [`api/README.md`](api/README.md) for details on why this runs inside the container rather than on the host):
   ```bash
   docker compose run --rm api npx prisma migrate dev
   ```

See [`api/README.md`](api/README.md) for backend-specific commands (tests, linting, Prisma).

## License

[MIT](LICENSE)
