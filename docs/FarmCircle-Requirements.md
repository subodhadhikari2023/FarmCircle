# FarmCircle — Requirements Document

**Version:** 1.0 (Draft — Functional Requirements Complete)
**Purpose:** Portfolio project demonstrating full-stack development skills using Next.js, NestJS, PostgreSQL, MongoDB, Redis, JWT/OAuth authentication, and Razorpay payment integration (test mode).

**Framing note:** This project is inspired by a personal long-term interest but is presented as a standalone case study — a single-business (single grower) produce marketplace connecting a grower to business buyers (vendors) and individual customers.

---

## 1. Overview

FarmCircle is a **single-grower produce marketplace platform**. One grower/business manages crop production and inventory; two categories of buyers (Vendors and Customers) browse and purchase produce, either as confirmed live stock or as pre-booked future yield (Vendors only). A System Admin role handles platform moderation (disputes, reviews, account suspension) as a distinct role from the Grower, who is the business owner/operator.

This is **not** a multi-seller marketplace. There is one grower/business entity in the system.

---

## 2. Roles

| Role | Description |
|---|---|
| **Grower** | Business owner/operator. Manages crop catalog, growth cycles, batches, listings, and business analytics. |
| **Vendor** | Business buyer (B2B). Can pre-book future yield and place bulk orders at wholesale pricing. |
| **Customer** | Individual buyer (B2C). Retail pricing only, no pre-booking. |
| **Admin** | System/platform administrator (not the business owner — that's Grower). Handles dispute resolution, review moderation, and account moderation. A role enforced via guarded endpoints on existing modules, not a business-facing role. |

Roles are separate, sophisticated, and independently scoped for the current version. A future direction (not built in v1) may introduce employee accounts under Grower and a hierarchical relationship between Admin and Grower — this should not influence the current permission model.

---

## 3. Grower — Requirements

### 3.1 Crop Catalog (foundational reference data)
- Grower adds a **Crop** to their catalog first (e.g., Tomato). A crop must exist in the catalog before it can be used anywhere else in the system.
- Each Crop can have one or more **Varieties/Cultivars** (e.g., Roma, Cherry, Beefsteak under Tomato).

### 3.2 Cycles (templates)
- Grower defines one or more **Cycle templates** per Crop (e.g., "Standard Tomato Cycle," "Fast-track Greenhouse Cycle"). Multiple cycles per crop are allowed.
- Each Cycle consists of an ordered set of **Milestones** (e.g., Sown → Germinated → Flowering → Harvest-ready), each with an expected duration.
- Cycle templates and milestone definitions are **visible only to the Grower/Admin** — never exposed as an editable/raw view to Vendors or Customers.

### 3.3 Batches (tracked instances)
- A **Batch** is created when the grower actually starts growing a crop. It is assigned a Crop + Variety and a chosen Cycle template.
- The Batch instantiates the Cycle's milestones as **trackable, dated progress** specific to that batch (not the crop type globally).
- Batch includes: quantity, variety, possible/predicted yield.
- Milestone progress on a batch is entered manually via the UI for v1. (Future improvisation: ML-based yield prediction or IoT sensor integration to auto-populate cycle/milestone data — noted as a designed-for-extensibility point, not built in v1.)

### 3.4 Listings (public-facing, sellable)
Two paths to create a Listing:

1. **Tracked path:** Crop → Cycle → Batch (milestone-tracked) → Listing, published once the batch is ready.
2. **Direct path:** Crop → Listing directly, bypassing Cycle/Batch tracking. Primarily intended for bootstrapping/onboarding existing stock, especially in early phases before cycle-tracking is fully adopted.

- Listings created via the tracked path expose a **read-only milestone/timeline view** to buyers. Listings via the direct path do not have this data (`hasTrackedCycle` flag distinguishes the two).
- **Cycle-end → Listing workflow:** When a Batch reaches its final milestone (harvest-ready), the Grower sets listing terms (price, wholesale MOQ, retail ceiling %, pre-bookable %) for that batch, which creates the Listing as an **unpublished draft**. The Grower then confirms the **actual harvested quantity** (predicted yield ≠ actual yield), which sets it and publishes the Listing — confirming harvest is rejected if listing terms haven't been set yet. This is also the trigger point for validating and confirming any queued pre-bookings against real, confirmed stock.
- **Price snapshotting (critical rule):** Once a Listing is published, its `retailPrice`, `wholesalePrice`, and `minWholesaleQty` are **locked for the life of that listing**, regardless of any later pricing changes the grower makes. Price changes only apply to **new** listings created afterward. Existing listings retain their original price until stock is fully sold.
- Each Listing defines:
  - `retailPrice` — for Customers
  - `wholesalePrice` — for Vendors, unlocked at `minWholesaleQty`
  - `minWholesaleQty` — minimum order quantity required to unlock wholesale pricing
  - `retailCeilingPercent` — grower-configurable, within a system-enforced sane range (e.g., 5–20%), determines the maximum quantity a Customer may order at retail price (see §5.2)
  - `preBookablePercent` — grower-determined, within range 50–70%, the portion of predicted yield that may be pre-booked before harvest (see §5.1)

### 3.5 Business Analytics (Grower)
- Grower has access to a **business-facing analytics dashboard**: revenue (test-mode figures), orders over time, top-selling crops, pre-booking vs. actual order split, wholesale vs. retail split.
- This is a business-owner capability, not a platform-operator one — the Grower role is the *business admin* in this system. System Admin (§7) is a separate, narrower platform-moderation role and does not own business analytics.

---

## 4. Vendor (B2B) — Requirements

- Standard account signup; no special verification/approval gate in v1.
- No independent inventory of their own — Vendor is a customer role, not a sub-seller.
- Full catalog visibility: both **future crops** (in-progress batches, pre-bookable) and **live stock** (harvested, ready to order).
- Can place:
  - **Pre-bookings** (see §5.1) — Vendor-exclusive.
  - **Actual orders** on live stock — same mechanics as Customer orders, but with wholesale pricing available at MOQ.
- Payment options: **COD, UPI, and online payment** (Razorpay, test mode) — available for actual orders. Pre-booking requires online/UPI payment for the advance (see §5.1).
- Order tracking (status visibility) same as Customer.
- **Reviews:** same as Customer — post-fulfillment, grower-level review, one per completed order.

---

## 5. Cross-Role Business Rules

### 5.1 Pre-booking (Vendor-exclusive)
- Available only while a Batch is still growing (pre-harvest).
- Capped at a **grower-determined percentage (50–70%) of predicted yield** — configured per batch/listing by the Grower.
- Pre-booking is **only bookable at the wholesale rate** — there is no retail-priced pre-booking, consistent with pre-booking being Vendor-only.
- **Workflow:**
  1. Vendor requests a pre-booking while the batch is still growing. Request enters a **queued/pending** state.
  2. Request remains queued until the batch's stock goes live (i.e., the grower confirms actual harvested quantity, per §3.4).
  3. Once live, the Vendor must pay a **20% advance via UPI/online payment (Razorpay, test mode)** to confirm the booking.
  4. If payment is not made within **48 hours** of stock going live, the pre-booking **expires and releases** its reserved capacity back to the bookable pool. (Recommended technical implementation: Redis TTL-backed hold.)
  5. Confirmed, paid pre-bookings convert into locked orders against live stock.

### 5.2 Retail order ceiling (Customer)
- To prevent individuals from bulk-purchasing at retail price in place of a Vendor, Customer order quantity is capped at:
  `minWholesaleQty × (1 + retailCeilingPercent / 100)` (grower-configurable per listing, within a system-enforced range, e.g., 5–20%).
  - Example: if wholesale unlocks at 15kg and the ceiling is 12%, a Customer may order up to ~16.8kg at retail price before the system should prevent further retail-priced quantity on that listing.

### 5.3 Wholesale pricing
- Set by the Grower per listing at creation time (`wholesalePrice`, `minWholesaleQty`).
- Applies to actual Vendor orders once order quantity ≥ `minWholesaleQty`. **If a Vendor's order quantity falls below `minWholesaleQty`, the order is priced at `retailPrice` instead** — wholesale pricing is not merely "available above a threshold," it explicitly falls back to retail pricing below it.
- Also applies to pre-bookings (pre-booking specifically requires wholesale-tier commitment — see §5.1).
- Locked per listing (price snapshotting, §3.4).
- **Note on percentage bounds:** the valid ranges for `preBookablePercent` (50–70%) and `retailCeilingPercent` (5–20%) are fixed validation constants baked into the schema/DTO layer (e.g., min/max validators), not a runtime-configurable admin feature. The Grower freely chooses the specific value per listing within these fixed bounds; the bounds themselves exist only to reject nonsensical/abusive input and are not something anyone adjusts at runtime.

### 5.4 Payments
- **Actual orders** (Vendor and Customer): COD, UPI, or online payment.
- **Pre-booking advance** (Vendor only): UPI/online payment only (20% of total).
- Payment integration: **Razorpay, test/sandbox mode.** Full real integration (API calls, Checkout UI, backend signature verification, webhook-driven status confirmation) is built as it would be in production — only the actual movement of money is fake (test UPI IDs / test cards). This is a deliberate choice to build genuine, transferable payment-integration experience rather than a custom-mocked flow.

---

## 6. Customer (B2C) — Requirements

- Standard account signup.
- Retail pricing only; no pre-booking access.
- Order quantity capped per §5.2.
- Can view the **milestone/timeline view** for listings created via the tracked path (read-only), supporting purchase decisions and transparency. Listings via the direct path show static info only (no timeline).
- **Delivery options:** both **delivery-to-address** and **pickup**, selected at checkout. Order status flow branches accordingly:
  - Delivery path: Placed → Confirmed → Out for Delivery → Delivered
  - Pickup path: Placed → Confirmed → Ready for Pickup → Picked Up
- **Reviews:** enabled post-fulfillment only (order must reach a terminal status). Available to **both Vendor and Customer** roles. Reviews are attached to the **Grower/business as a whole**, not to individual listings or products — since listings/products change rapidly while the grower's identity persists. One review per completed order (`growerId` + `orderId`).

---

## 7. Admin — Requirements

**Admin is the system/platform administrator — not the business owner.** The Grower role is the business owner/operator (see §3.5). Admin is enforced as a **role, not a separate backend module** — its capabilities are implemented as Admin-only guarded endpoints on the existing modules that own the relevant data (see §11), not as standalone Admin data or logic.

- **Order & dispute management:** view all orders (Vendor + Customer), resolve stuck states (e.g., payment failed but stock reserved, delivery disputes), manual status override where needed.
- **User management:** view/manage Vendor and Customer accounts (suspend, view activity).
- **Review moderation:** hide/remove abusive or fake reviews.

Note: the business-wide analytics dashboard is a **Grower** capability (§3.5), not Admin's. The percentage-range validation bounds (§5.3) are fixed schema/DTO constants, not a runtime Admin configuration feature.

---

## 8. Explicitly Out of Scope (v1)

- Multi-grower / multi-seller marketplace support.
- Live GPS delivery tracking.
- Recurring/subscription orders.
- ML-based yield prediction / IoT sensor integration (noted as future improvisation, not built).
- Hierarchical Admin/Grower permission inheritance and employee-under-Grower accounts (future direction only).
- Per-listing/per-product reviews (reviews are grower-level only).
- Live payment processing (test/sandbox mode only, throughout).

---

## 9. Key Design Decisions Worth Highlighting (for portfolio/interview narrative)

1. **Template vs. instance pattern:** Cycle (template, reusable, grower-only) vs. Batch (instance, tracked progress) — mirrors workflow-template-vs-workflow-run patterns common in real systems.
2. **Price snapshotting:** Listing prices are immutable once published, a standard real-world e-commerce pattern to prevent retroactive price shifts on active listings.
3. **Dynamic retail ceiling:** Customer order caps are computed relative to each listing's own wholesale threshold, not a flat global limit.
4. **Redis-backed reservation holds:** Pre-booking capacity holds with TTL-based auto-expiry is a textbook, defensible Redis use case (also applicable to stock-locking during checkout to prevent overselling).
5. **Genuine payment gateway integration in test mode:** Full production-shaped payment flow (order creation, Checkout UI, signature verification, webhook confirmation) without real financial risk — directly transferable to real client work.
6. **Two paths to a Listing** (tracked vs. direct): supports both rigorous cycle-tracking and pragmatic fast onboarding, a realistic compromise seen in real operational software.

---

## 11. Technical Stack (Finalized)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Backend | NestJS |
| Relational DB | PostgreSQL + Prisma |
| Document DB | MongoDB + Mongoose |
| Cache/Locks | Redis |
| Auth | JWT (access + refresh) + Google OAuth (Passport) |
| Password hashing | Argon2 |
| Payments | Razorpay (test/sandbox mode) — full real integration (Checkout UI, signature verification, webhooks), only actual money movement is fake |
| Testing | Jest — **strict TDD** for NestJS backend business logic (pricing/eligibility calculations, order/pre-booking state transitions, auth guards); lighter/after-the-fact testing for Next.js frontend and third-party integration glue (Razorpay webhooks, OAuth callbacks) |
| Containerization | Docker |
| CI/CD | GitHub Actions (GitHub-hosted runners) — CI on every PR, plus a separate Deploy workflow that builds/pushes the API image to GHCR, runs prod migrations, and redeploys on every push to `main` |
| Repo structure | Monorepo, plain (no Turborepo) |
| Frontend deployment | Vercel |
| Backend deployment | Render, pulling a pre-built image from GHCR (not building from source on the platform) |

---

## 12. Backend Module Architecture (NestJS)

Ten modules, each owning a distinct data/domain concern. No module exists purely to represent a role — roles (including Admin) are enforced via **Guards** (`@Roles()` decorator + `RolesGuard`) on endpoints within the module that owns the relevant data, not via separate per-role modules.

| Module | Owns | Notes |
|---|---|---|
| **AuthModule** | Registration, login, JWT (access/refresh), Google OAuth | |
| **UsersModule** | One `User` entity, `role` enum (Grower/Vendor/Customer/Admin) | Includes Admin-gated account suspension/viewing endpoints |
| **CatalogModule** | Crop + Variety | Grower's reference catalog; must exist before Cycle/Listing use it |
| **CycleModule** | Cycle templates + Milestones | Grower/Admin-visible only, never exposed raw to buyers |
| **BatchModule** | Batch instances, milestone progress | Instantiates a Cycle's milestones per actual planting |
| **InventoryModule** | Published, sellable Listings (naming note: this module represents what was scoped as "Listing" — retail/wholesale pricing, price snapshotting, `hasTrackedCycle` flag — named Inventory per product decision) | Two creation paths: tracked (via Batch) and direct (via Crop) |
| **OrderModule** | Actual orders (COD/UPI/online), delivery/pickup, status flow | Includes Admin-gated dispute resolution endpoints |
| **PreBookingModule** | Queued pre-booking holds, 48h TTL, wholesale-only | Depends on BatchModule (yield %) and OrderModule (conversion on confirmation) |
| **PaymentModule** | Razorpay integration | Shared by OrderModule and PreBookingModule |
| **ReviewModule** | Grower-level reviews (`growerId` + `orderId`, post-fulfillment only) | Includes Admin-gated moderation endpoints |

**Design rule applied throughout:** a module is justified only if it owns its own entity/data, or its logic genuinely spans multiple entities within a single combined operation. A role (like Admin) that only performs guarded CRUD/moderation on a single existing entity does not get its own module — it gets a guarded endpoint inside the module that already owns that entity. This rule is why there is no separate `AdminModule` and no separate per-role modules for Grower/Vendor/Customer.

---

## 13. Open Items for Technical Specification Phase

To be addressed next, before schema design begins:
- `preBookablePercent` (within 50–70%) and `retailCeilingPercent` (within 5–20%) are provided by the Grower per listing at the time of listing creation — no separate default/bounds decision needed here; the system only needs to enforce that the Grower's input falls within these ranges.
- Pre-booking hold expiry window: **48 hours** after the batch's final milestone (harvest-ready) is hit and stock goes live. If the Vendor's 20% advance payment is not made within this window, the hold releases per §5.1.
- Delivery/pickup address model: local address text (street/area/city/pincode), an optional landmark field, and location coordinates (latitude/longitude) capturable via a map picker, openable in Google Maps for the delivery agent.
- Review data shape (decided ad hoc during `ReviewModule` implementation, not derived from spec beforehand): `rating` is a required integer 1–5; `comment` is optional, max 1000 characters; moderation is a simple visible/hidden flag, reversible by Admin (`hide` / `unhide`), with a dedicated `GET /reviews/hidden` so a takedown is never a one-way door.
