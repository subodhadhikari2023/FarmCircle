# FarmCircle — API Design

**Version:** 1.0
**Companion to:** FarmCircle-Requirements.md
**Scope:** REST endpoint design for all 10 backend modules. Status codes follow the decision tree established earlier: 400 (malformed request), 401 (not authenticated), 403 (authenticated but not permitted), 404 (resource doesn't exist), 409 (well-formed request conflicts with current state), 422 (fails business validation), 201 (created), 204 (success, nothing to return).

**Auth convention throughout:** every endpoint except those explicitly marked *(public)* requires a valid JWT access token (`Authorization: Bearer <token>`), enforced by `JwtAuthGuard`. Role restrictions are enforced by `RolesGuard` + `@Roles()`, noted per endpoint. `(own)` means a user may only access/act on their own resource, enforced by comparing `request.user.id` against the resource's owner field, not by role alone.

---

## 1. AuthModule

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /auth/register` | *(public)* | Register as Vendor or Customer, with role selection. Grower and Admin accounts are not self-registerable in v1 — seeded/created directly (single-business scope). | `201 Created` | `400` invalid input; `409` email already exists |
| `POST /auth/login` | *(public)* | Email + password login, returns access token, sets refresh token as httpOnly cookie | `200 OK` | `401` invalid credentials |
| `POST /auth/refresh` | *(public, requires valid refresh cookie)* | Issues a new access token using the refresh token | `200 OK` | `401` refresh token invalid/expired |
| `POST /auth/logout` | Any authenticated role | Invalidates refresh token (removed/blacklisted), clears cookie | `204 No Content` | `401` not authenticated |
| `GET /auth/google` | *(public)* | Initiates Google OAuth flow | `302` redirect to Google | — |
| `GET /auth/google/callback` | *(public)* | OAuth callback, creates/logs in user, issues tokens | `200 OK` / redirect to frontend with token | `401` OAuth failure |

---

## 2. UsersModule

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `GET /users/me` | Any authenticated role (own) | Get own profile | `200 OK` | `401` |
| `PATCH /users/me` | Any authenticated role (own) | Update own profile fields | `200 OK` | `400` invalid fields |
| `GET /users` | Admin | List all Vendor/Customer accounts | `200 OK` | `403` non-admin |
| `GET /users/:id` | Admin | View a specific account | `200 OK` | `404` not found; `403` non-admin |
| `PATCH /users/:id/suspend` | Admin | Suspend an account | `200 OK` | `404`; `403`; `409` if already suspended |
| `PATCH /users/:id/reactivate` | Admin | Reactivate a suspended account | `200 OK` | `404`; `403`; `409` if not suspended |

---

## 3. CatalogModule (Crop + Variety)

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /crops` | Grower | Add a new Crop to the catalog | `201 Created` | `400`; `409` duplicate crop name |
| `GET /crops` | Grower | List the catalog | `200 OK` | — |
| `GET /crops/:id` | Grower | View a Crop's detail | `200 OK` | `404` |
| `PATCH /crops/:id` | Grower | Edit a Crop | `200 OK` | `404`; `400` |
| `DELETE /crops/:id` | Grower | Remove a Crop (soft delete recommended — check for dependent Cycles/Batches/Listings first) | `204 No Content` | `404`; `409` if in-use by active Cycles/Batches/Listings |
| `POST /crops/:id/varieties` | Grower | Add a Variety under a Crop | `201 Created` | `404` crop not found; `400` |
| `GET /crops/:id/varieties` | Grower | List Varieties under a Crop | `200 OK` | `404` |
| `PATCH /varieties/:id` | Grower | Edit a Variety | `200 OK` | `404` |
| `DELETE /varieties/:id` | Grower | Remove a Variety | `204 No Content` | `404`; `409` if in use |

---

## 4. CycleModule (templates + milestones)

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /cycles` | Grower | Create a Cycle template independently, assigning it to a Crop via a `cropId` field in the request body (not a nested crop route) | `201 Created` | `404` cropId not found; `400` |
| `GET /cycles` | Grower | List all Cycle templates, filterable by crop via `?cropId=` query param | `200 OK` | — |
| `GET /cycles/:id` | Grower | View a Cycle template, including its Milestones | `200 OK` | `404` |
| `PATCH /cycles/:id` | Grower | Edit a Cycle template | `200 OK` | `404` |
| `DELETE /cycles/:id` | Grower | Remove a Cycle template | `204 No Content` | `404`; `409` if in use by a Batch |
| `POST /cycles/:id/milestones` | Grower | Add a Milestone to a Cycle | `201 Created` | `404` |
| `PATCH /milestones/:id` | Grower | Edit a Milestone (name, expected duration, order) — allowed even if Batches already exist against this Cycle, since delays or crop issues are a normal real-world occurrence | `200 OK` | `404` |
| `DELETE /milestones/:id` | Grower | Remove a Milestone | `204 No Content` | `404`; `409` if a Batch has already progressed past it |

---

## 5. BatchModule

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /batches` | Grower | Start a new Batch — Crop + Variety + Cycle, quantity, predicted yield | `201 Created` | `400`; `404` if crop/variety/cycle not found |
| `GET /batches` | Grower | List own Batches (all statuses) | `200 OK` | — |
| `GET /batches/:id` | Grower | View a Batch's full detail (internal view) | `200 OK` | `404` |
| `PATCH /batches/:id/milestone` | Grower | Advance the Batch to its next Milestone, with a date | `200 OK` | `404`; `409` if milestones are out of order |
| `POST /batches/:id/activity` | Grower | Add a freeform activity note for a Batch (Mongo-backed `BatchActivityLog` — notes, not milestone progress; extension point for future ML/IoT auto-logging) | `201 Created` | `404` |
| `PATCH /batches/:id/confirm-harvest` | Grower | Confirm actual harvested quantity once the final Milestone is reached. Does **not** create the Listing itself — requires `POST /inventory/from-batch/:batchId` (§6) to have already set listing terms; this endpoint only sets `actualYield` and flips that draft Listing to published. Also transitions any queued pre-bookings against this batch to `AWAITING_PAYMENT` | `200 OK` | `404`; `409` if not yet at final milestone, or listing terms haven't been set yet; `400` invalid quantity |
| `GET /batches/:id/timeline` | *(public)* | Read-only milestone/timeline view for buyers (only for `hasTrackedCycle = true` listings) | `200 OK` | `404` |

---

## 6. InventoryModule (Listings)

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /inventory/from-batch/:batchId` | Grower | Set listing terms (price, wholesale MOQ, retail ceiling %, pre-bookable %) for a Batch that has reached its final Milestone — creates the Listing as an unpublished draft (`isPublished: false`). Must run before `PATCH /batches/:id/confirm-harvest` (§5), which is what actually publishes it | `201 Created` | `404` batch not found; `409` if batch hasn't reached final milestone, or a Listing already exists for it; `400` |
| `POST /inventory` | Grower | Create a Listing directly from a Crop (direct path, bypassing Cycle/Batch) | `201 Created` | `404` crop not found; `400` |
| `GET /inventory` | *(public)* | Browse all live listings | `200 OK` | — |
| `GET /inventory/mine` | Grower (own) | List all of the requesting Grower's own listings, including unpublished drafts and closed ones, with wholesale pricing always included | `200 OK` | `403` non-Grower |
| `GET /inventory/upcoming` | Vendor | View listings/batches still growing, open for pre-booking | `200 OK` | `403` non-vendor |
| `GET /inventory/:id` | *(public)* | Listing detail — retail price always shown; wholesale price/MOQ shown only to authenticated Vendors | `200 OK` | `404` |
| `PATCH /inventory/:id` | Grower | Edit a Listing (note: price fields are locked post-publish per price-snapshotting rule — only non-price fields like description are editable) | `200 OK` | `404`; `409` if attempting to edit a locked price field |
| `PATCH /inventory/:id/close` | Grower | Close/deactivate a Listing (soft close, not delete). Note: unlike `create`/`update`/`get`, the response does not merge in the Mongo `ListingContent` fields (`description`/`images`/`isOrganicCertified`/`attributes` come back unset) | `200 OK` | `404`; `409` if already closed |

---

## 7. OrderModule

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /orders` | Vendor, Customer | Place an actual order on live stock (COD/UPI/online); applies wholesale-vs-retail pricing logic and retail ceiling check server-side | `201 Created` | `400`; `409` insufficient stock or quantity exceeds retail ceiling (Customer) |
| `GET /orders` | Vendor/Customer (own), Grower (own listings' orders), Admin (all) | List orders | `200 OK` | `401` |
| `GET /orders/:id` | Vendor/Customer (own), Grower (own listing's order), Admin | View order detail + status | `200 OK` | `404`; `403` if not own and not Admin |
| `PATCH /orders/:id/status` | Grower | Update fulfillment status (Confirmed → Out for Delivery/Ready for Pickup → Delivered/Picked Up) | `200 OK` | `404`; `409` invalid status transition |
| `PATCH /orders/:id/dispute` | Admin | Resolve a disputed/stuck order (manual override) | `200 OK` | `404`; `403` non-admin |
| `PATCH /orders/:id/cancel` | Vendor/Customer (own, before fulfillment starts) | Cancel an order | `200 OK` | `404`; `409` if already past a cancellable status |

---

## 8. PreBookingModule

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /prebookings` | Vendor | Join the queue for a growing Batch, requesting a quantity | `201 Created` | `400` invalid quantity; `409` would exceed `preBookablePercent × predictedYield` (atomic Redis check) |
| `PATCH /prebookings/:id/cancel` | Vendor (own) | Cancel a queued pre-booking — **only allowed while status is `QUEUED`** (i.e., before stock goes live). Atomically decrements the Redis capacity counter, freeing that quantity for other Vendors. | `200 OK` | `404`; `409` if already `AWAITING_PAYMENT` or later (once live, cancellation is no longer available — see auto-expiry below) |
| `GET /prebookings` | Vendor (own), Admin (all) | List pre-bookings | `200 OK` | `401` |
| `GET /prebookings/:id` | Vendor (own), Admin | View a specific pre-booking's status | `200 OK` | `404`; `403` if not own |
| `GET /prebookings/:id/payment-intent` | Vendor (own) | Once `AWAITING_PAYMENT`, initiate Razorpay order creation for the 20% advance | `200 OK` | `400` if still `QUEUED` |
| `POST /prebookings/:id/verify-payment` | Vendor (own) | Frontend-side signature verification after Checkout modal closes (fast UX path) | `200 OK` | `400` invalid signature |
| `POST /prebookings/webhook` | *(Razorpay only, signature-authenticated, not JWT)* | Trusted confirmation — moves status to `CONFIRMED`, creates an Order, decrements Inventory stock, deletes Redis hold | `200 OK` | `400` invalid webhook signature |

---

## 9. PaymentModule

Mostly internal, invoked by OrderModule and PreBookingModule rather than called directly by end users — documented separately since it's shared logic.

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /payments/create-order` | Internal (called by Order/PreBooking services) | Creates a Razorpay order object, returns `razorpay_order_id` | `200 OK` | `502` if Razorpay API call fails |
| `POST /payments/verify` | Internal | HMAC signature verification of a payment response | `200 OK` | `400` invalid signature |
| `POST /payments/webhook` | *(Razorpay only)* | Shared webhook receiver — routes to Order or PreBooking confirmation logic based on payload metadata | `200 OK` | `400` invalid signature |

---

## 10. ReviewModule

| Method + Path | Access | Purpose | Success | Key failures |
|---|---|---|---|---|
| `POST /reviews` | Vendor, Customer (own, post-fulfillment order) | Submit a grower-level review tied to a completed order | `201 Created` | `400`; `404` order not found; `409` order not yet delivered/picked-up, or already reviewed |
| `GET /reviews` | *(public)* | View all (non-hidden) reviews for the grower/business | `200 OK` | — |
| `GET /reviews/:id` | *(public)* | View a specific review | `200 OK` | `404` |
| `PATCH /reviews/:id/hide` | Admin | Moderate — hide an abusive/fake review | `200 OK` | `404`; `403` non-admin |

---

## Notes & Open Questions Carried Forward

1. **Vendor/Customer order cancellation — confirmed.** The `PATCH /orders/:id/cancel` endpoint stands as designed: cancellable by the order's owner (Vendor or Customer), only while the order is in a pre-fulfillment status (before "Out for Delivery"/"Ready for Pickup"). Exact cancellable-status cutoff to be finalized in schema design when the full order status enum is defined.
2. **Pre-booking cancellation — confirmed.** Vendors may cancel a queued pre-booking any time before stock goes live (`PATCH /prebookings/:id/cancel`, status must still be `QUEUED`). Once stock goes live and status moves to `AWAITING_PAYMENT`, manual cancellation is no longer available — the only exit path at that point is the existing 48-hour auto-expiry (unpaid → `EXPIRED` → capacity released), not a user-initiated cancel. This keeps the Redis atomic counter consistent: a manual cancel decrements it explicitly while `QUEUED`; an expiry releases it automatically via TTL once live.
3. **Cycle/Milestone edits after Batches exist — confirmed, edits allowed.** `PATCH /cycles/:id` and `PATCH /milestones/:id` no longer block on existing Batches — real-world delays and crop issues mean the Grower needs to adjust milestone durations/order even mid-use. **Schema implication worth flagging for the next phase:** since a Batch already *instantiates its own copy* of the Cycle's milestones at creation time (per §3.3 of the requirements doc), editing the Cycle template afterward only affects *future* Batches created from it going forward — it does not retroactively change milestone data on Batches already in progress, since those hold their own snapshot. This is consistent with the same snapshotting principle already applied to Listing prices.
4. **Vendor review eligibility — confirmed.** Both Vendor and Customer roles can leave a grower-level review, under the same rule (post-fulfillment, one per completed order). Updated across the requirements doc and this endpoint accordingly.
5. **Grower self-service listing/order visibility — gap closed.** Growers previously had no way to list their own listings or orders, despite owning the endpoints that mutate them (`PATCH /inventory/:id`, `PATCH /orders/:id/status`). Added `GET /inventory/mine` (own listings, including unpublished drafts and closed ones, always with wholesale pricing) and extended `GET /orders`/`GET /orders/:id` to Growers, scoped to orders on their own listings.
