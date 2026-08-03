# FarmCircle

A single-grower produce marketplace connecting crop production directly to wholesale (Vendor) and retail (Customer) buyers.

[![CI](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/ci.yml)
[![Deploy](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/deploy.yml/badge.svg)](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Highlight

Deployed end-to-end via a hand-rolled CI/CD pipeline — GitHub Actions builds and pushes a Docker image to GHCR, runs production migrations, and redeploys the API automatically on every merge to main.

## Tech Stack

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

- Next.js
- NestJS
- TypeScript
- PostgreSQL
- Prisma
- MongoDB
- Redis
- JWT
- Google OAuth
- Razorpay
- Docker
- GitHub Actions
- Vercel
- Render

## Features

- Four role-based experiences (Grower, Vendor, Customer, Admin), each with its own guarded frontend and API-enforced permissions
- Grower-managed crop catalog with cycle templates and milestone-based batch tracking from planting to harvest, with harvest-ready listings drafted from completed batches once the Grower sets pricing
- Tracked and direct listing paths; wholesale (Vendor) and retail (Customer) pricing with per-listing bounds, automatic retail-ceiling fallback, and price snapshotting at listing creation
- Pre-booking system for future yield — capacity caps, 48-hour payment-hold windows with automatic expiry (cron + Redis TTL), and webhook-confirmed conversion to a real order
- Razorpay-integrated checkout for both direct orders (COD/UPI/online) and pre-booking advances, with idempotent webhook handling shared across both flows
- JWT authentication (access + refresh token rotation, httpOnly cookies) with Google OAuth, role-based guards, refresh-token-reuse detection, and per-IP login rate limiting
- Post-fulfillment grower reviews with reversible Admin moderation (hide/unhide)
- Deployed end-to-end: NestJS API containerized and pushed to GHCR by GitHub Actions, running on Render; Next.js frontend on Vercel; Postgres/Mongo/Redis on Neon/Atlas/Upstash

## Getting Started

```bash
git clone https://github.com/subodhadhikari2023/FarmCircle.git
cd FarmCircle
```

Requires Docker and Docker Compose for the backend, plus Node 22+ for the frontend.

1. Copy the example env files and fill in the values (see the comments in each for where to get Google OAuth credentials, Razorpay test keys, and how to generate the JWT/OAuth-state secrets):
   ```bash
   cp .env.example .env
   cp web/.env.example web/.env
   ```
2. Bring up the backend stack:
   ```bash
   docker compose up -d --build
   ```
   This starts Postgres, Mongo, Redis, and the API (`http://localhost:3000`) in watch mode.
3. Apply database migrations (see [`api/README.md`](api/README.md) for why this runs inside the container rather than on the host):
   ```bash
   docker compose run --rm api npx prisma migrate dev
   ```
4. Run the frontend:
   ```bash
   cd web
   npm install
   npm run dev
   ```
   The app runs at `http://localhost:3001`.

See [`api/README.md`](api/README.md) for backend-specific commands (tests, linting, Prisma).

## Live Demo

[Live Demo](https://farm-circle.vercel.app)

Backend: [`https://farmcircle-api.onrender.com`](https://farmcircle-api.onrender.com) — a Render free-tier service, so the first request after ~15 minutes of inactivity can take 30–60 seconds to wake up.

### Test Credentials

Don't want to use your own Google account? Log in with these instead (Customer and Vendor roles only — sign-up for those two roles is open, but Grower/Admin aren't self-registerable, so there's nothing to demo there beyond what these accounts already show):

| Role | Email | Password |
|---|---|---|
| Customer | `customer1@farmcircle.app` | `Customer123` |
| Customer | `customer2@farmcircle.app` | `Customer123` |
| Customer | `customer3@farmcircle.app` | `Customer123` |
| Vendor | `vendor1@farmcircle.app` | `Vendor123` |
| Vendor | `vendor2@farmcircle.app` | `Vendor123` |
| Vendor | `vendor3@farmcircle.app` | `Vendor123` |

The catalog has 50 seeded listings (produce, prices, wholesale/retail terms) to browse and order against.

---

## Project Status

All four roles (Grower, Vendor, Customer, Admin) have a complete backend and frontend, deployed and live at the links above. The ten backend modules described in [`docs/`](docs/) are all built; MongoDB (listing content, batch activity notes, order status history) and Redis (pre-booking capacity/hold TTLs) are fully wired in alongside the Postgres/Prisma core.

## Documentation

The full product spec lives in [`docs/`](docs/):

- [`FarmCircle-Requirements.md`](docs/FarmCircle-Requirements.md) — roles, business rules, module list
- [`FarmCircle-API-Design.md`](docs/FarmCircle-API-Design.md) — endpoint-by-endpoint REST design with access rules and status codes
- [`FarmCircle-Schema-Design.md`](docs/FarmCircle-Schema-Design.md) — Postgres/Mongo/Redis schema rationale
- [`FarmCircle-Design-System.md`](docs/FarmCircle-Design-System.md) — frontend design system (palette, type, spacing, voice)

## Repo Layout

```
api/            NestJS backend — see api/README.md
web/            Next.js frontend (Grower/Vendor/Customer/Admin, plus the public landing/browse pages)
docs/           Product/architecture specs (requirements, API design, schema design, design system)
docker-compose.yml   postgres + mongo + redis + api, for local dev
```

## License

[MIT](LICENSE)
