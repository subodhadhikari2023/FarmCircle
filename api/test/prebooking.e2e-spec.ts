import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { createHmac } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { PreBookingsService } from './../src/prebooking/prebookings.service';
import { RazorpayClient } from './../src/payment/razorpay-client.service';
import {
  Role,
  PreBookingStatus,
  PaymentStatus,
} from './../generated/prisma/enums';

describe('PreBookingModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let preBookingsService: PreBookingsService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
  const createdCycleIds: string[] = [];
  const createdMilestoneIds: string[] = [];
  const createdBatchIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdPreBookingIds: string[] = [];
  const PASSWORD = 'Test-Password-123';
  const mockRazorpayClient = { createOrder: jest.fn() };

  async function createUser(role: Role, label: string) {
    const passwordHash = await argon2.hash(PASSWORD);
    const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@farmcircle.test`;
    const user = await prisma.user.create({
      data: { name: `E2E ${label}`, email, passwordHash, role },
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function loginAndGetToken(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function createCrop(ownerId: string, name: string) {
    const crop = await prisma.crop.create({ data: { ownerId, name } });
    createdCropIds.push(crop.id);
    return crop;
  }

  async function createVariety(cropId: string, name: string) {
    const variety = await prisma.variety.create({ data: { cropId, name } });
    createdVarietyIds.push(variety.id);
    return variety;
  }

  async function createCycle(ownerId: string, cropId: string, name: string) {
    const cycle = await prisma.cycle.create({
      data: { ownerId, cropId, name },
    });
    createdCycleIds.push(cycle.id);
    return cycle;
  }

  async function createMilestone(
    cycleId: string,
    name: string,
    order: number,
    expectedDurationDays: number,
  ) {
    const milestone = await prisma.milestone.create({
      data: { cycleId, name, order, expectedDurationDays },
    });
    createdMilestoneIds.push(milestone.id);
    return milestone;
  }

  async function createBatchAtFinalMilestone(
    ownerId: string,
    cropId: string,
    varietyId: string,
    cycleId: string,
    predictedYield: number,
  ) {
    const batch = await prisma.batch.create({
      data: {
        ownerId,
        cropId,
        varietyId,
        cycleId,
        quantity: 100,
        predictedYield,
        currentMilestoneOrder: 1,
      },
    });
    createdBatchIds.push(batch.id);
    const milestone = await createMilestone(cycleId, 'Harvested', 1, 10);
    await prisma.batchMilestoneProgress.create({
      data: { batchId: batch.id, milestoneId: milestone.id, order: 1 },
    });
    return batch;
  }

  async function createDraftListing(
    ownerId: string,
    cropId: string,
    varietyId: string,
    batchId: string,
    preBookablePercent: number,
  ) {
    const listing = await prisma.listing.create({
      data: {
        ownerId,
        cropId,
        varietyId,
        batchId,
        hasTrackedCycle: true,
        retailPrice: 50,
        wholesalePrice: 35,
        minWholesaleQty: 15,
        retailCeilingPercent: 10,
        preBookablePercent,
        availableQuantity: 0,
        isPublished: false,
      },
    });
    createdListingIds.push(listing.id);
    return listing;
  }

  async function moveToAwaitingPayment(
    preBookingId: string,
    listingId: string,
    advanceAmount: number,
  ) {
    return prisma.preBooking.update({
      where: { id: preBookingId },
      data: {
        status: PreBookingStatus.AWAITING_PAYMENT,
        listingId,
        advanceAmount,
        holdExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
  }

  async function createSetup(label: string, predictedYield = 100) {
    const grower = await createUser(Role.GROWER, `${label}-grower`);
    const vendor = await createUser(Role.VENDOR, `${label}-vendor`);
    const vendorToken = await loginAndGetToken(vendor.email);
    const crop = await createCrop(grower.id, `Crop ${label}`);
    const variety = await createVariety(crop.id, `Variety ${label}`);
    const cycle = await createCycle(grower.id, crop.id, `Cycle ${label}`);
    const batch = await createBatchAtFinalMilestone(
      grower.id,
      crop.id,
      variety.id,
      cycle.id,
      predictedYield,
    );
    return { grower, vendor, vendorToken, crop, variety, cycle, batch };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RazorpayClient)
      .useValue(mockRazorpayClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    preBookingsService = app.get(PreBookingsService);
  });

  afterAll(async () => {
    if (createdPreBookingIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { preBookingId: { in: createdPreBookingIds } },
      });
      await prisma.order.deleteMany({
        where: { preBookingId: { in: createdPreBookingIds } },
      });
      await prisma.preBooking.deleteMany({
        where: { id: { in: createdPreBookingIds } },
      });
    }
    if (createdListingIds.length > 0) {
      await prisma.listing.deleteMany({
        where: { id: { in: createdListingIds } },
      });
    }
    if (createdBatchIds.length > 0) {
      await prisma.batchMilestoneProgress.deleteMany({
        where: { batchId: { in: createdBatchIds } },
      });
      await prisma.batch.deleteMany({
        where: { id: { in: createdBatchIds } },
      });
    }
    if (createdMilestoneIds.length > 0) {
      await prisma.milestone.deleteMany({
        where: { id: { in: createdMilestoneIds } },
      });
    }
    if (createdCycleIds.length > 0) {
      await prisma.cycle.deleteMany({
        where: { id: { in: createdCycleIds } },
      });
    }
    if (createdVarietyIds.length > 0) {
      await prisma.variety.deleteMany({
        where: { id: { in: createdVarietyIds } },
      });
    }
    if (createdCropIds.length > 0) {
      await prisma.crop.deleteMany({ where: { id: { in: createdCropIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  describe('POST /prebookings', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/prebookings')
        .send({ batchId: 'irrelevant', quantity: 10 })
        .expect(401);
    });

    it('returns 403 for a non-Vendor', async () => {
      const customer = await createUser(Role.CUSTOMER, 'create-nonvendor');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ batchId: 'irrelevant', quantity: 10 })
        .expect(403);
    });

    it('returns 404 when the batch does not exist', async () => {
      const vendor = await createUser(Role.VENDOR, 'create-nobatch');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: '00000000-0000-0000-0000-000000000000',
          quantity: 10,
        })
        .expect(404);
    });

    it('returns 404 when listing terms have not been set for the batch yet', async () => {
      const setup = await createSetup('create-noterms');

      await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(404);
    });

    it('returns 409 when the batch has already been harvested', async () => {
      const setup = await createSetup('create-harvested');
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      await prisma.batch.update({
        where: { id: setup.batch.id },
        data: { harvestConfirmed: true },
      });

      await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(409);
    });

    it('creates a QUEUED pre-booking within the pre-bookable capacity', async () => {
      const setup = await createSetup('create-happy', 100);
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );

      const res = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 40 })
        .expect(201);
      const body = res.body as { id: string; status: string };
      expect(body.status).toBe(PreBookingStatus.QUEUED);
      createdPreBookingIds.push(body.id);
    });

    it('returns 409 once combined queued quantity would exceed preBookablePercent x predictedYield', async () => {
      const setup = await createSetup('create-overcap', 100);
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );

      const first = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 50 })
        .expect(201);
      createdPreBookingIds.push((first.body as { id: string }).id);

      await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 20 })
        .expect(409);
    });
  });

  describe('PATCH /prebookings/:id/cancel', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .patch('/prebookings/irrelevant/cancel')
        .expect(401);
    });

    it('returns 404 for a pre-booking not owned by the requesting Vendor', async () => {
      const setup = await createSetup('cancel-notowned');
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const res = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (res.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      const otherVendor = await createUser(Role.VENDOR, 'cancel-other');
      const otherToken = await loginAndGetToken(otherVendor.email);

      await request(app.getHttpServer())
        .patch(`/prebookings/${preBookingId}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('cancels a QUEUED pre-booking and releases its Redis capacity for others to reserve', async () => {
      const setup = await createSetup('cancel-happy', 100);
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );

      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 50 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      const res = await request(app.getHttpServer())
        .patch(`/prebookings/${preBookingId}/cancel`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .expect(200);
      expect((res.body as { status: string }).status).toBe(
        PreBookingStatus.CANCELLED,
      );

      const second = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 50 })
        .expect(201);
      createdPreBookingIds.push((second.body as { id: string }).id);
    });

    it('returns 409 when the pre-booking is no longer QUEUED', async () => {
      const setup = await createSetup('cancel-notqueued');
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);
      await prisma.preBooking.update({
        where: { id: preBookingId },
        data: { status: PreBookingStatus.AWAITING_PAYMENT },
      });

      await request(app.getHttpServer())
        .patch(`/prebookings/${preBookingId}/cancel`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .expect(409);
    });
  });

  describe('GET /prebookings', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/prebookings').expect(401);
    });

    it("lists only the Vendor's own pre-bookings, and all pre-bookings for Admin", async () => {
      const setup = await createSetup('list-happy');
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      const otherVendor = await createUser(Role.VENDOR, 'list-other');
      const otherToken = await loginAndGetToken(otherVendor.email);
      const ownRes = await request(app.getHttpServer())
        .get('/prebookings')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(
        (ownRes.body as Array<{ id: string }>).map((p) => p.id),
      ).not.toContain(preBookingId);

      const admin = await createUser(Role.ADMIN, 'list-admin');
      const adminToken = await loginAndGetToken(admin.email);
      const adminRes = await request(app.getHttpServer())
        .get('/prebookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (adminRes.body as Array<{ id: string }>).map((p) => p.id),
      ).toContain(preBookingId);
    });
  });

  describe('GET /prebookings/:id', () => {
    it('returns 404 for an unknown pre-booking', async () => {
      const vendor = await createUser(Role.VENDOR, 'getone-unknown');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .get('/prebookings/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 403 when a different Vendor requests it, and 200 for its own Vendor and for Admin', async () => {
      const setup = await createSetup('getone-happy');
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      const otherVendor = await createUser(Role.VENDOR, 'getone-other');
      const otherToken = await loginAndGetToken(otherVendor.email);
      await request(app.getHttpServer())
        .get(`/prebookings/${preBookingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get(`/prebookings/${preBookingId}`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .expect(200);

      const admin = await createUser(Role.ADMIN, 'getone-admin');
      const adminToken = await loginAndGetToken(admin.email);
      await request(app.getHttpServer())
        .get(`/prebookings/${preBookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('expireOverdueHolds (48h auto-expiry sweep)', () => {
    it('expires an overdue AWAITING_PAYMENT hold and releases its capacity for others to reserve', async () => {
      const setup = await createSetup('expire-happy', 100);
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );

      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 60 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      await prisma.preBooking.update({
        where: { id: preBookingId },
        data: {
          status: PreBookingStatus.AWAITING_PAYMENT,
          holdExpiresAt: new Date(Date.now() - 1000),
        },
      });

      await preBookingsService.expireOverdueHolds();

      const expired = await prisma.preBooking.findUniqueOrThrow({
        where: { id: preBookingId },
      });
      expect(expired.status).toBe(PreBookingStatus.EXPIRED);

      const second = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 60 })
        .expect(201);
      createdPreBookingIds.push((second.body as { id: string }).id);
    });

    it('leaves AWAITING_PAYMENT holds untouched before their holdExpiresAt', async () => {
      const setup = await createSetup('expire-notyet', 100);
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );

      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      await prisma.preBooking.update({
        where: { id: preBookingId },
        data: {
          status: PreBookingStatus.AWAITING_PAYMENT,
          holdExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      await preBookingsService.expireOverdueHolds();

      const stillAwaiting = await prisma.preBooking.findUniqueOrThrow({
        where: { id: preBookingId },
      });
      expect(stillAwaiting.status).toBe(PreBookingStatus.AWAITING_PAYMENT);
    });
  });

  describe('GET /prebookings/:id/payment-intent', () => {
    beforeEach(() => {
      mockRazorpayClient.createOrder.mockReset();
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get('/prebookings/irrelevant/payment-intent')
        .expect(401);
    });

    it('returns 400 while the pre-booking is still QUEUED', async () => {
      const setup = await createSetup('intent-queued', 100);
      await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);

      await request(app.getHttpServer())
        .get(`/prebookings/${preBookingId}/payment-intent`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .expect(400);
    });

    it('creates a Razorpay order for the 20% advance once AWAITING_PAYMENT', async () => {
      const setup = await createSetup('intent-happy', 100);
      const listing = await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);
      await moveToAwaitingPayment(preBookingId, listing.id, 70);

      mockRazorpayClient.createOrder.mockResolvedValue({
        id: 'order_test_intent',
        amount: 7000,
        currency: 'INR',
      });

      const res = await request(app.getHttpServer())
        .get(`/prebookings/${preBookingId}/payment-intent`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        razorpayOrderId: 'order_test_intent',
        amount: 70,
        currency: 'INR',
      });
      expect(mockRazorpayClient.createOrder).toHaveBeenCalledWith(
        7000,
        preBookingId,
      );
    });

    it('returns 409 when the pre-booking has already been paid', async () => {
      const setup = await createSetup('intent-alreadypaid', 100);
      const listing = await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);
      await moveToAwaitingPayment(preBookingId, listing.id, 70);
      await prisma.payment.create({
        data: {
          preBookingId,
          amount: 70,
          method: 'ONLINE',
          status: PaymentStatus.SUCCESS,
          razorpayOrderId: 'order_already_paid',
        },
      });

      await request(app.getHttpServer())
        .get(`/prebookings/${preBookingId}/payment-intent`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .expect(409);
    });
  });

  describe('POST /prebookings/:id/verify-payment', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/prebookings/irrelevant/verify-payment')
        .send({
          razorpayOrderId: 'x',
          razorpayPaymentId: 'y',
          razorpaySignature: 'z',
        })
        .expect(401);
    });

    it('returns 400 when the signature does not match', async () => {
      const setup = await createSetup('verify-badsig', 100);
      const listing = await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);
      await moveToAwaitingPayment(preBookingId, listing.id, 70);
      await prisma.payment.create({
        data: {
          preBookingId,
          amount: 70,
          method: 'ONLINE',
          status: PaymentStatus.PENDING,
          razorpayOrderId: 'order_verify_badsig',
        },
      });

      await request(app.getHttpServer())
        .post(`/prebookings/${preBookingId}/verify-payment`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({
          razorpayOrderId: 'order_verify_badsig',
          razorpayPaymentId: 'pay_x',
          razorpaySignature: 'not-a-real-signature',
        })
        .expect(400);
    });

    it('marks the Payment SUCCESS when the signature is valid', async () => {
      const setup = await createSetup('verify-happy', 100);
      const listing = await createDraftListing(
        setup.grower.id,
        setup.crop.id,
        setup.variety.id,
        setup.batch.id,
        60,
      );
      const created = await request(app.getHttpServer())
        .post('/prebookings')
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({ batchId: setup.batch.id, quantity: 10 })
        .expect(201);
      const preBookingId = (created.body as { id: string }).id;
      createdPreBookingIds.push(preBookingId);
      await moveToAwaitingPayment(preBookingId, listing.id, 70);
      await prisma.payment.create({
        data: {
          preBookingId,
          amount: 70,
          method: 'ONLINE',
          status: PaymentStatus.PENDING,
          razorpayOrderId: 'order_verify_happy',
        },
      });

      const razorpayOrderId = 'order_verify_happy';
      const razorpayPaymentId = 'pay_verify_happy';
      const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post(`/prebookings/${preBookingId}/verify-payment`)
        .set('Authorization', `Bearer ${setup.vendorToken}`)
        .send({
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: signature,
        })
        .expect(200);

      expect((res.body as { status: string }).status).toBe(
        PaymentStatus.SUCCESS,
      );
    });
  });
});
