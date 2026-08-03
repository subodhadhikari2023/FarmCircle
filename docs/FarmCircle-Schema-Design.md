# FarmCircle — Schema Design

**Version:** 1.0
**Companion to:** FarmCircle-Requirements.md, FarmCircle-API-Design.md

---

## 1. Database Split — Rationale

Following the same principle established earlier in this project (relational/transactional data → PostgreSQL, flexible/variable-shape data → MongoDB):

**PostgreSQL (via Prisma)** holds everything with strict relationships and correctness requirements: users, crop/cycle/batch structure, listings, orders, pre-bookings, payments, reviews. This is the transactional core — stock counts, prices, and payment state all need ACID guarantees.

**MongoDB (via Mongoose)** holds supplementary, variable-shape content that doesn't need relational integrity: listing media/descriptions (different crops have different attributes — some organic-certified, some not, varying photo counts), batch activity notes (freeform grower observations per milestone — also the natural home for the future ML/IoT extensibility mentioned in the requirements doc), and order status history logs (append-only audit trail).

**Redis** (recap, not repeated in full here) holds only ephemeral/derived state: the pre-booking capacity counter per batch, and the 48-hour TTL hold once a pre-booking reaches `AWAITING_PAYMENT`.

---

## 2. PostgreSQL Schema (Prisma)

```prisma
// schema.prisma
// Prisma 7 style: custom output path + driver adapter, no bare DATABASE_URL
// client — see prisma.config.ts for the actual connection config.

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
  moduleFormat = "cjs"
  importFileExtension = ""
}

datasource db {
  provider = "postgresql"
}

// ─── Enums ───────────────────────────────────────────────

enum Role {
  GROWER
  VENDOR
  CUSTOMER
  ADMIN
}

enum DeliveryMethod {
  DELIVERY
  PICKUP
}

enum OrderStatus {
  PLACED
  CONFIRMED
  OUT_FOR_DELIVERY
  READY_FOR_PICKUP
  DELIVERED
  PICKED_UP
  CANCELLED
}

enum PreBookingStatus {
  QUEUED
  AWAITING_PAYMENT
  CONFIRMED
  EXPIRED
  CANCELLED
}

enum PaymentMethod {
  COD
  UPI
  ONLINE
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
}

// ─── Users ───────────────────────────────────────────────

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String?  // nullable: OAuth-only users won't have one
  googleId     String?  @unique
  role         Role
  isSuspended  Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Grower-side relations
  crops       Crop[]
  cycles      Cycle[]
  batches     Batch[]
  listings    Listing[]

  // Buyer-side relations
  ordersAsBuyer Order[]       @relation("BuyerOrders")
  orderIntents  OrderIntent[]
  preBookings   PreBooking[]
  addresses     Address[]

  // RefreshToken
  refreshTokens RefreshToken[]

  // Review relations (a User can both give reviews and, if Grower, receive them)
  reviewsGiven    Review[] @relation("ReviewerReviews")
  reviewsReceived Review[] @relation("GrowerReviews")
}

// ─── Auth Sessions ───────────────────────────────────────

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}

// ─── Catalog ─────────────────────────────────────────────

model Crop {
  id        String   @id @default(uuid())
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  varieties Variety[]
  cycles    Cycle[]
  batches   Batch[]
  listings  Listing[] // populated for direct-path listings

  @@unique([ownerId, name])
}

model Variety {
  id        String   @id @default(uuid())
  cropId    String
  crop      Crop     @relation(fields: [cropId], references: [id])
  name      String
  createdAt DateTime @default(now())

  batches  Batch[]
  listings Listing[]

  @@unique([cropId, name])
}

// ─── Cycles & Milestones (templates) ───────────────────

model Cycle {
  id        String   @id @default(uuid())
  cropId    String
  crop      Crop     @relation(fields: [cropId], references: [id])
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  milestones Milestone[]
  batches    Batch[]
}

model Milestone {
  id                   String @id @default(uuid())
  cycleId              String
  cycle                Cycle  @relation(fields: [cycleId], references: [id])
  name                 String
  order                Int
  expectedDurationDays Int

  progressEntries BatchMilestoneProgress[]

  @@unique([cycleId, order])
}

// ─── Batches (tracked instances) ───────────────────────

model Batch {
  id                    String   @id @default(uuid())
  ownerId               String
  owner                 User     @relation(fields: [ownerId], references: [id])
  cropId                String
  crop                  Crop     @relation(fields: [cropId], references: [id])
  varietyId             String
  variety               Variety  @relation(fields: [varietyId], references: [id])
  cycleId               String?  // null if this batch will use the direct listing path instead
  cycle                 Cycle?   @relation(fields: [cycleId], references: [id])
  quantity              Decimal
  predictedYield        Decimal
  actualYield           Decimal?
  currentMilestoneOrder Int      @default(0)
  harvestConfirmed      Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  milestoneProgress BatchMilestoneProgress[]
  listing           Listing?
  preBookings       PreBooking[]
}

// Snapshot of a Cycle's milestones at the time a Batch is created —
// editing the Cycle template later does not retroactively change
// data on Batches already in progress (same snapshotting principle as Listing prices).
model BatchMilestoneProgress {
  id          String    @id @default(uuid())
  batchId     String
  batch       Batch     @relation(fields: [batchId], references: [id])
  milestoneId String
  milestone   Milestone @relation(fields: [milestoneId], references: [id])
  order       Int
  reachedAt   DateTime?

  @@unique([batchId, milestoneId])
}

// ─── Listings (Inventory) ──────────────────────────────

model Listing {
  id                   String   @id @default(uuid())
  ownerId              String
  owner                User     @relation(fields: [ownerId], references: [id])
  cropId               String
  crop                 Crop     @relation(fields: [cropId], references: [id])
  varietyId            String
  variety              Variety  @relation(fields: [varietyId], references: [id])
  batchId              String?  @unique // null for direct-path listings
  batch                Batch?   @relation(fields: [batchId], references: [id])
  hasTrackedCycle      Boolean  @default(false)

  // Snapshotted at creation — immutable for the life of this listing
  retailPrice          Decimal
  wholesalePrice       Decimal
  minWholesaleQty      Decimal
  retailCeilingPercent Decimal // grower-chosen value within fixed 5–20 validation bound
  preBookablePercent   Decimal // grower-chosen value within fixed 50–70 validation bound

  availableQuantity Decimal
  isPublished       Boolean  @default(false) // false while a draft awaiting harvest confirmation
  isClosed          Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  orders       Order[]
  orderIntents OrderIntent[]
  preBookings  PreBooking[]

  @@index([ownerId])
}

// ─── Orders ─────────────────────────────────────────────

model Address {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  addressText String
  landmark    String?
  latitude    Float
  longitude   Float
  createdAt   DateTime @default(now())

  orders       Order[]
  orderIntents OrderIntent[]
}

model Order {
  id             String         @id @default(uuid())
  buyerId        String
  buyer          User           @relation("BuyerOrders", fields: [buyerId], references: [id])
  listingId      String
  listing        Listing        @relation(fields: [listingId], references: [id])
  quantity       Decimal
  unitPrice      Decimal        // snapshot: whichever of retail/wholesale applied
  totalAmount    Decimal
  deliveryMethod DeliveryMethod
  addressId      String?        // null if pickup
  address        Address?       @relation(fields: [addressId], references: [id])
  status         OrderStatus    @default(PLACED)
  paymentMethod  PaymentMethod
  preBookingId   String?        @unique // set if this order originated from a confirmed pre-booking
  preBooking     PreBooking?    @relation(fields: [preBookingId], references: [id])
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  payment Payment?
  review  Review?

  @@index([buyerId])
  @@index([listingId])
  @@index([status])
}

// Snapshot of a would-be Order's details, created for UPI/ONLINE checkouts
// before payment is confirmed — the real Order is only created once the
// Razorpay webhook confirms payment.captured (see PaymentsService.handleWebhook).
// COD orders skip this entirely since payment isn't gating anything.
model OrderIntent {
  id             String         @id @default(uuid())
  buyerId        String
  buyer          User           @relation(fields: [buyerId], references: [id])
  listingId      String
  listing        Listing        @relation(fields: [listingId], references: [id])
  quantity       Decimal
  unitPrice      Decimal
  totalAmount    Decimal
  deliveryMethod DeliveryMethod
  addressId      String?
  address        Address?       @relation(fields: [addressId], references: [id])
  paymentMethod  PaymentMethod
  createdAt      DateTime       @default(now())

  payment Payment?
}

// ─── Pre-bookings ───────────────────────────────────────

model PreBooking {
  id            String           @id @default(uuid())
  vendorId      String
  vendor        User             @relation(fields: [vendorId], references: [id])
  batchId       String
  batch         Batch            @relation(fields: [batchId], references: [id])
  listingId     String?          // linked once the batch's listing goes live
  listing       Listing?         @relation(fields: [listingId], references: [id])
  quantity      Decimal
  status        PreBookingStatus @default(QUEUED)
  advanceAmount Decimal?         // 20% of wholesale total, computed once AWAITING_PAYMENT begins
  holdExpiresAt DateTime?        // set once AWAITING_PAYMENT begins (mirrors the Redis TTL)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  order   Order?
  payment Payment?

  @@index([vendorId])
  @@index([batchId])
  @@index([status])
}

// ─── Payments ───────────────────────────────────────────

model Payment {
  id                 String        @id @default(uuid())
  orderId            String?       @unique
  order              Order?        @relation(fields: [orderId], references: [id])
  preBookingId       String?       @unique
  preBooking         PreBooking?   @relation(fields: [preBookingId], references: [id])
  orderIntentId      String?       @unique
  orderIntent        OrderIntent?  @relation(fields: [orderIntentId], references: [id])
  razorpayOrderId    String?
  razorpayPaymentId  String?
  razorpaySignature  String?
  amount             Decimal
  method             PaymentMethod
  status             PaymentStatus @default(PENDING)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@index([razorpayOrderId])
}

// ─── Reviews ────────────────────────────────────────────

model Review {
  id         String   @id @default(uuid())
  reviewerId String
  reviewer   User     @relation("ReviewerReviews", fields: [reviewerId], references: [id])
  growerId   String
  grower     User     @relation("GrowerReviews", fields: [growerId], references: [id])
  orderId    String   @unique // enforces one review per completed order
  order      Order    @relation(fields: [orderId], references: [id])
  rating     Int      // 1–5
  comment    String?
  isHidden   Boolean  @default(false) // Admin moderation flag
  createdAt  DateTime @default(now())
}
```

**Notes on key design choices in this schema:**

- `Batch.cycleId` and `Listing.batchId` are both nullable — this is exactly how the two Listing creation paths (tracked vs. direct) are represented: a direct-path Batch/Listing simply has no Cycle/Batch reference.
- `BatchMilestoneProgress` is a **snapshot table**, not a live join to `Milestone` — each row copies the `order` value at Batch-creation time, so later edits to the Cycle template (now allowed, per your confirmed decision) never retroactively alter a Batch already in progress.
- `Listing`'s pricing/percentage fields have no `updatedAt`-triggered change path in the application logic — they're written once at creation and never touched again, enforcing price-snapshotting at the schema level (the application layer must simply never expose a way to PATCH these specific fields, since Prisma itself won't stop you from writing to them).
- `Order.preBookingId` and `Payment.orderId` / `Payment.preBookingId` / `Payment.orderIntentId` are all nullable/optional — an `Order` can exist either from a direct purchase or from a converted pre-booking, and a `Payment` can belong to an `Order`, a `PreBooking`, or an `OrderIntent` (the UPI/ONLINE pre-`Order` snapshot, before the webhook confirms payment and creates the real `Order`), reflecting the shared `PaymentModule` design.
- `Review.orderId` is marked `@unique` — this is what enforces "one review per completed order" directly at the database level, not just in application logic.

---

## 3. MongoDB Schema (Mongoose)

Implemented as NestJS `@nestjs/mongoose` decorator-based schema classes (not raw `new Schema({...})`), matching the rest of the codebase's NestJS idioms:

```typescript
// listing-content.schema.ts
// Flexible, per-listing supplementary content — varies by crop type
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ListingContentDocument = HydratedDocument<ListingContent>;

@Schema({ timestamps: true }) // auto-manages createdAt + updatedAt (updatedAt refreshes on every save)
export class ListingContent {
  @Prop({ required: true, index: true })
  listingId: string; // references Postgres Listing.id

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  images: string[]; // URLs

  @Prop({ default: false })
  isOrganicCertified: boolean;

  @Prop({ type: Object })
  attributes?: Record<string, unknown>; // free-form: e.g. { color: 'red', size: 'medium' } — varies per crop
}

export const ListingContentSchema = SchemaFactory.createForClass(ListingContent);
```

```typescript
// batch-activity-log.schema.ts
// Freeform grower notes/observations per batch, independent of formal milestone progress.
// This is also the designed extension point for future ML/IoT-based auto-logging (per requirements §3.3).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BatchActivityLogDocument = HydratedDocument<BatchActivityLog>;
export type BatchActivityLogSource = 'manual' | 'ml_model' | 'iot_sensor';

// createdAt is renamed to loggedAt; updatedAt is deliberately disabled —
// these are append-only log entries, never edited after creation.
@Schema({ timestamps: { createdAt: 'loggedAt', updatedAt: false } })
export class BatchActivityLog {
  @Prop({ required: true, index: true })
  batchId: string; // references Postgres Batch.id

  @Prop()
  note?: string;

  @Prop({ type: [String], default: [] })
  photos: string[]; // URLs

  @Prop({ enum: ['manual', 'ml_model', 'iot_sensor'], default: 'manual' })
  source: BatchActivityLogSource; // future-ready

  loggedAt?: Date;
}

export const BatchActivityLogSchema = SchemaFactory.createForClass(BatchActivityLog);
```

```typescript
// order-status-history.schema.ts
// Append-only audit trail of order status changes — useful for dispute resolution (Admin)
// and for showing customers a detailed timeline, without bloating the relational Order table.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderStatusHistoryDocument = HydratedDocument<OrderStatusHistory>;

@Schema() // no timestamps option here — changedAt below is the one and only timestamp
export class OrderStatusHistory {
  @Prop({ required: true, index: true })
  orderId: string; // references Postgres Order.id

  @Prop({ required: true })
  status: string; // mirrors OrderStatus enum values as strings

  @Prop()
  note?: string; // e.g., delivery agent remark, dispute note

  @Prop()
  changedBy?: string; // User id who triggered the change (Grower, Admin, or system)

  @Prop({ default: Date.now })
  changedAt: Date;
}

export const OrderStatusHistorySchema = SchemaFactory.createForClass(OrderStatusHistory);
```

**Why these three, specifically:** each holds data that's either genuinely variable-shape (`attributes` on `ListingContent` differs per crop type) or is naturally append-only/log-like (`BatchActivityLog`, `OrderStatusHistory`) rather than a single mutable row — exactly the kind of data Mongoose/MongoDB handles more naturally than a rigid relational table would, without forcing you to add nullable columns for every possible crop-specific attribute in Postgres.

---

## 4. Redis Key Patterns (recap, for reference alongside this schema)

| Key pattern | Purpose | TTL |
|---|---|---|
| `prebooking:queued:{batchId}` | Running atomic counter (Lua-scripted `reserveCapacity`/`releaseQueueCapacity`) of total quantity queued against a batch's `preBookablePercent` cap | None — no TTL is set; the counter only moves via individual pre-booking cancel/expiry decrementing it, there's no bulk clear/recalculation on listing close |
| `prebooking:hold:{preBookingId}` | Marks an individual pre-booking's 48-hour payment window once `AWAITING_PAYMENT` begins | 48 hours |

---

## 5. Open Items Carried Forward

1. **Cascade/delete behavior — still unset, migrations already exist.** Despite migrations being written and the schema being fully built out, most relations (`Crop → Variety/Cycle/Batch`, `Cycle → Milestone`, etc.) still have no explicit `onDelete` clause — Prisma/Postgres falls back to its implicit restrict-like default. The one deliberate exception is `RefreshToken.user`, which sets `onDelete: Cascade` (a user's refresh tokens should be deleted along with the user, not block their deletion). Recommend `Restrict` explicitly everywhere else data has business significance, to make the current implicit behavior a documented, intentional choice rather than an accident of Prisma's default.
2. **Decimal precision** — `Decimal` fields (quantity, prices, percentages) will need explicit precision/scale set in the Postgres migration (e.g., `@db.Decimal(10, 2)`) — worth deciding standard precision across the board (e.g., 2 decimal places for currency, but quantity in kg might reasonably want more).
3. **Address reuse** — `Address` is modeled as its own table linked to `User`, allowing a buyer to save multiple addresses and pick one per order. Confirm this matches your intent, versus a simpler embedded address directly on `Order`.
