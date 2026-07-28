# FarmCircle

A single-grower produce marketplace connecting crop production directly to wholesale (Vendor) and retail (Customer) buyers.

[![CI](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/ci.yml/badge.svg)](https://github.com/subodhadhikari2023/FarmCircle/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Highlight

JWT authentication with access/refresh token rotation, httpOnly cookie storage, and Argon2-hashed credentials — fully unit tested.

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

## Features

- Grower-managed crop catalog with cycle templates and milestone-based batch tracking from planting to harvest
- Tracked and direct listing paths, with harvest-ready listings auto-drafted from completed batches
- Wholesale (Vendor) and retail (Customer) pricing with per-listing bounds and automatic retail-ceiling fallback
- Pre-booking system for future yield with capacity caps, payment holds, and automatic expiry
- JWT authentication (access + refresh tokens) with Google OAuth and role-based access control
- Razorpay payment integration for orders and pre-booking deposits
- Post-fulfillment grower reviews

## Getting Started

```bash
git clone https://github.com/subodhadhikari2023/FarmCircle.git
cd FarmCircle
```

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
3. Apply database migrations (see [`api/README.md`](api/README.md) for why this runs inside the container rather than on the host):
   ```bash
   docker compose run --rm api npx prisma migrate dev
   ```

See [`api/README.md`](api/README.md) for backend-specific commands (tests, linting, Prisma).

---

## Project Status

Early scaffolding. Only the [`api/`](api/) NestJS backend exists so far — the `AuthModule` (registration, login, JWT access/refresh tokens) is implemented and tested; the rest of the domain modules described in [`docs/`](docs/) are not yet built. The Next.js frontend has not been started.

## Documentation

The full product spec lives in [`docs/`](docs/):

- [`FarmCircle-Requirements.md`](docs/FarmCircle-Requirements.md) — roles, business rules, module list
- [`FarmCircle-API-Design.md`](docs/FarmCircle-API-Design.md) — endpoint-by-endpoint REST design with access rules and status codes
- [`FarmCircle-Schema-Design.md`](docs/FarmCircle-Schema-Design.md) — Postgres/Mongo/Redis schema rationale

## Repo Layout

```
api/            NestJS backend (the only app that currently exists) — see api/README.md
docs/           Product/architecture specs (requirements, API design, schema design)
docker-compose.yml   postgres + mongo + redis + api, for local dev
```

## License

[MIT](LICENSE)
