import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { createHmac } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RazorpayClient } from './../src/payment/razorpay-client.service';
import {
  Role,
  PreBookingStatus,
  PaymentStatus,
  DeliveryMethod,
  PaymentMethod,
} from './../generated/prisma/enums';

describe('PaymentModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
  const createdCycleIds: string[] = [];
  const createdMilestoneIds: string[] = [];
  const createdBatchIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdPreBookingIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdOrderIntentIds: string[] = [];
  const mockRazorpayClient = { createOrder: jest.fn() };

  function sign(body: string) {
    return createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');
  }

  async function createGrowerAndVendor(label: string) {
    const passwordHash = await argon2.hash('Test-Password-123');
    const grower = await prisma.user.create({
      data: {
        name: `E2E ${label} grower`,
        email: `e2e-${label}-grower-${Date.now()}-${Math.random().toString(36).slice(2)}@farmcircle.test`,
        passwordHash,
        role: Role.GROWER,
      },
    });
    const vendor = await prisma.user.create({
      data: {
        name: `E2E ${label} vendor`,
        email: `e2e-${label}-vendor-${Date.now()}-${Math.random().toString(36).slice(2)}@farmcircle.test`,
        passwordHash,
        role: Role.VENDOR,
      },
    });
    createdUserIds.push(grower.id, vendor.id);
    return { grower, vendor };
  }

  async function createConfirmablePreBooking(label: string) {
    const { grower, vendor } = await createGrowerAndVendor(label);
    const crop = await prisma.crop.create({
      data: { ownerId: grower.id, name: `Crop ${label}` },
    });
    createdCropIds.push(crop.id);
    const variety = await prisma.variety.create({
      data: { cropId: crop.id, name: `Variety ${label}` },
    });
    createdVarietyIds.push(variety.id);
    const cycle = await prisma.cycle.create({
      data: { ownerId: grower.id, cropId: crop.id, name: `Cycle ${label}` },
    });
    createdCycleIds.push(cycle.id);
    const batch = await prisma.batch.create({
      data: {
        ownerId: grower.id,
        cropId: crop.id,
        varietyId: variety.id,
        cycleId: cycle.id,
        quantity: 100,
        predictedYield: 100,
        currentMilestoneOrder: 1,
      },
    });
    createdBatchIds.push(batch.id);
    const milestone = await prisma.milestone.create({
      data: {
        cycleId: cycle.id,
        name: 'Harvested',
        order: 1,
        expectedDurationDays: 10,
      },
    });
    createdMilestoneIds.push(milestone.id);
    await prisma.batchMilestoneProgress.create({
      data: { batchId: batch.id, milestoneId: milestone.id, order: 1 },
    });
    const listing = await prisma.listing.create({
      data: {
        ownerId: grower.id,
        cropId: crop.id,
        varietyId: variety.id,
        batchId: batch.id,
        hasTrackedCycle: true,
        retailPrice: 50,
        wholesalePrice: 35,
        minWholesaleQty: 15,
        retailCeilingPercent: 10,
        preBookablePercent: 60,
        availableQuantity: 100,
        isPublished: true,
      },
    });
    createdListingIds.push(listing.id);
    const preBooking = await prisma.preBooking.create({
      data: {
        vendorId: vendor.id,
        batchId: batch.id,
        listingId: listing.id,
        quantity: 40,
        status: PreBookingStatus.AWAITING_PAYMENT,
        advanceAmount: 280,
        holdExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    createdPreBookingIds.push(preBooking.id);
    return { grower, vendor, listing, preBooking };
  }

  async function createOrderIntentSetup(label: string) {
    const { grower, vendor: customer } = await createGrowerAndVendor(label);
    const crop = await prisma.crop.create({
      data: { ownerId: grower.id, name: `Crop ${label}` },
    });
    createdCropIds.push(crop.id);
    const variety = await prisma.variety.create({
      data: { cropId: crop.id, name: `Variety ${label}` },
    });
    createdVarietyIds.push(variety.id);
    const listing = await prisma.listing.create({
      data: {
        ownerId: grower.id,
        cropId: crop.id,
        varietyId: variety.id,
        hasTrackedCycle: false,
        retailPrice: 50,
        wholesalePrice: 35,
        minWholesaleQty: 15,
        retailCeilingPercent: 10,
        preBookablePercent: 60,
        availableQuantity: 100,
        isPublished: true,
      },
    });
    createdListingIds.push(listing.id);
    const intent = await prisma.orderIntent.create({
      data: {
        buyerId: customer.id,
        listingId: listing.id,
        quantity: 5,
        unitPrice: 50,
        totalAmount: 250,
        deliveryMethod: DeliveryMethod.PICKUP,
        paymentMethod: PaymentMethod.ONLINE,
      },
    });
    createdOrderIntentIds.push(intent.id);
    return { customer, listing, intent };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RazorpayClient)
      .useValue(mockRazorpayClient)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
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
  });

  afterAll(async () => {
    if (createdOrderIntentIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { orderIntentId: { in: createdOrderIntentIds } },
      });
      await prisma.order.deleteMany({
        where: { listingId: { in: createdListingIds } },
      });
      await prisma.orderIntent.deleteMany({
        where: { id: { in: createdOrderIntentIds } },
      });
    }
    if (createdOrderIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
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

  describe('POST /payments/webhook', () => {
    it('returns 400 when the signature is invalid', async () => {
      const body = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_x', order_id: 'order_x' } },
        },
      });

      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'not-the-right-signature')
        .send(body)
        .expect(400);
    });

    it('confirms the pre-booking, creates the resulting Order, and decrements Listing stock', async () => {
      const { vendor, listing, preBooking } =
        await createConfirmablePreBooking('webhook-happy');
      await prisma.payment.create({
        data: {
          preBookingId: preBooking.id,
          amount: 280,
          method: 'ONLINE',
          status: PaymentStatus.PENDING,
          razorpayOrderId: 'order_webhook_happy',
        },
      });

      const body = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_happy',
              order_id: 'order_webhook_happy',
            },
          },
        },
      });

      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sign(body))
        .send(body)
        .expect(200);

      const confirmedPreBooking = await prisma.preBooking.findUniqueOrThrow({
        where: { id: preBooking.id },
      });
      expect(confirmedPreBooking.status).toBe(PreBookingStatus.CONFIRMED);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { preBookingId: preBooking.id },
      });
      expect(payment.status).toBe(PaymentStatus.SUCCESS);
      expect(payment.razorpayPaymentId).toBe('pay_webhook_happy');

      const order = await prisma.order.findFirstOrThrow({
        where: { preBookingId: preBooking.id },
      });
      expect(order.buyerId).toBe(vendor.id);
      expect(order.listingId).toBe(listing.id);
      expect(order.quantity.toNumber()).toBe(40);
      expect(order.totalAmount.toNumber()).toBe(1400);

      const updatedListing = await prisma.listing.findUniqueOrThrow({
        where: { id: listing.id },
      });
      expect(updatedListing.availableQuantity.toNumber()).toBe(60);
    });

    it('converts a direct-order OrderIntent into a real Order and decrements stock', async () => {
      const { customer, listing, intent } =
        await createOrderIntentSetup('webhook-order');
      await prisma.payment.create({
        data: {
          orderIntentId: intent.id,
          amount: 250,
          method: 'ONLINE',
          status: PaymentStatus.PENDING,
          razorpayOrderId: 'order_webhook_direct',
        },
      });

      const body = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_direct',
              order_id: 'order_webhook_direct',
            },
          },
        },
      });

      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sign(body))
        .send(body)
        .expect(200);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { orderIntentId: intent.id },
      });
      expect(payment.status).toBe(PaymentStatus.SUCCESS);
      expect(payment.razorpayPaymentId).toBe('pay_webhook_direct');
      expect(payment.orderId).not.toBeNull();

      const order = await prisma.order.findFirstOrThrow({
        where: { listingId: listing.id },
      });
      expect(order.buyerId).toBe(customer.id);
      expect(order.quantity.toNumber()).toBe(5);
      expect(order.totalAmount.toNumber()).toBe(250);

      const updatedListing = await prisma.listing.findUniqueOrThrow({
        where: { id: listing.id },
      });
      expect(updatedListing.availableQuantity.toNumber()).toBe(95);
    });
  });
});
