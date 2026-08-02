import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { createHmac } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { RazorpayClient } from './../src/payment/razorpay-client.service';
import {
  OrderStatusHistory,
  OrderStatusHistoryDocument,
} from './../src/order/schemas/order-status-history.schema';
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
} from './../generated/prisma/enums';

describe('OrderModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let historyModel: Model<OrderStatusHistoryDocument>;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdAddressIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdOrderIntentIds: string[] = [];
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

  async function createListing(
    ownerId: string,
    cropId: string,
    varietyId: string,
    overrides: Partial<{
      retailPrice: number;
      wholesalePrice: number;
      minWholesaleQty: number;
      retailCeilingPercent: number;
      availableQuantity: number;
      isPublished: boolean;
      isClosed: boolean;
    }> = {},
  ) {
    const listing = await prisma.listing.create({
      data: {
        ownerId,
        cropId,
        varietyId,
        hasTrackedCycle: false,
        retailPrice: overrides.retailPrice ?? 50,
        wholesalePrice: overrides.wholesalePrice ?? 35,
        minWholesaleQty: overrides.minWholesaleQty ?? 15,
        retailCeilingPercent: overrides.retailCeilingPercent ?? 10,
        preBookablePercent: 60,
        availableQuantity: overrides.availableQuantity ?? 100,
        isPublished: overrides.isPublished ?? true,
        isClosed: overrides.isClosed ?? false,
      },
    });
    createdListingIds.push(listing.id);
    return listing;
  }

  async function createAddress(userId: string) {
    const address = await prisma.address.create({
      data: {
        userId,
        addressText: '123 Farm Lane',
        latitude: 12.34,
        longitude: 56.78,
      },
    });
    createdAddressIds.push(address.id);
    return address;
  }

  async function createOrder(
    buyerId: string,
    listingId: string,
    overrides: Partial<{
      status: OrderStatus;
      quantity: number;
      paymentMethod: PaymentMethod;
    }> = {},
  ) {
    const order = await prisma.order.create({
      data: {
        buyerId,
        listingId,
        quantity: overrides.quantity ?? 5,
        unitPrice: 50,
        totalAmount: (overrides.quantity ?? 5) * 50,
        deliveryMethod: DeliveryMethod.PICKUP,
        paymentMethod: overrides.paymentMethod ?? PaymentMethod.COD,
        status: overrides.status ?? OrderStatus.PLACED,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  const pickupBody = (listingId: string, quantity: number) => ({
    listingId,
    quantity,
    deliveryMethod: DeliveryMethod.PICKUP,
    paymentMethod: PaymentMethod.COD,
  });

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
    historyModel = app.get(getModelToken(OrderStatusHistory.name));
  });

  afterAll(async () => {
    if (createdOrderIntentIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { orderIntentId: { in: createdOrderIntentIds } },
      });
      await prisma.orderIntent.deleteMany({
        where: { id: { in: createdOrderIntentIds } },
      });
    }
    if (createdOrderIds.length > 0) {
      await historyModel.deleteMany({
        orderId: { $in: createdOrderIds },
      });
      await prisma.payment.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (createdAddressIds.length > 0) {
      await prisma.address.deleteMany({
        where: { id: { in: createdAddressIds } },
      });
    }
    if (createdListingIds.length > 0) {
      await prisma.listing.deleteMany({
        where: { id: { in: createdListingIds } },
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

  describe('POST /orders', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send(pickupBody('irrelevant', 1))
        .expect(401);
    });

    it('returns 403 for a Grower', async () => {
      const grower = await createUser(Role.GROWER, 'create-grower');
      const token = await loginAndGetToken(grower.email);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(pickupBody('irrelevant', 1))
        .expect(403);
    });

    it('returns 404 for a listing that does not exist', async () => {
      const customer = await createUser(Role.CUSTOMER, 'create-nolisting');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(pickupBody('00000000-0000-0000-0000-000000000000', 1))
        .expect(404);
    });

    it('returns 409 when quantity exceeds available stock', async () => {
      const grower = await createUser(Role.GROWER, 'create-stock-grower');
      const customer = await createUser(Role.CUSTOMER, 'create-stock-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Tomato');
      const variety = await createVariety(crop.id, 'Roma');
      const listing = await createListing(grower.id, crop.id, variety.id, {
        availableQuantity: 5,
      });

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(pickupBody(listing.id, 10))
        .expect(409);
    });

    it('returns 409 when a Customer order exceeds the retail ceiling', async () => {
      const grower = await createUser(Role.GROWER, 'create-ceiling-grower');
      const customer = await createUser(Role.CUSTOMER, 'create-ceiling-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Carrot');
      const variety = await createVariety(crop.id, 'Nantes');
      // minWholesaleQty 15, retailCeilingPercent 10 => ceiling is 16.5
      const listing = await createListing(grower.id, crop.id, variety.id);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(pickupBody(listing.id, 17))
        .expect(409);
    });

    it('prices a Vendor order at wholesale once quantity meets minWholesaleQty and decrements stock', async () => {
      const grower = await createUser(Role.GROWER, 'create-wholesale-grower');
      const vendor = await createUser(Role.VENDOR, 'create-wholesale-vendor');
      const token = await loginAndGetToken(vendor.email);
      const crop = await createCrop(grower.id, 'Spinach');
      const variety = await createVariety(crop.id, 'Baby Spinach');
      const listing = await createListing(grower.id, crop.id, variety.id, {
        availableQuantity: 100,
      });

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(pickupBody(listing.id, 15))
        .expect(201);

      const body = res.body as { id: string; unitPrice: string };
      createdOrderIds.push(body.id);
      expect(body.unitPrice).toBe('35');

      const updatedListing = await prisma.listing.findUniqueOrThrow({
        where: { id: listing.id },
      });
      expect(updatedListing.availableQuantity.toNumber()).toBe(85);
    });

    it('falls back a Vendor order below minWholesaleQty to retail pricing', async () => {
      const grower = await createUser(Role.GROWER, 'create-fallback-grower');
      const vendor = await createUser(Role.VENDOR, 'create-fallback-vendor');
      const token = await loginAndGetToken(vendor.email);
      const crop = await createCrop(grower.id, 'Kale');
      const variety = await createVariety(crop.id, 'Curly Kale');
      const listing = await createListing(grower.id, crop.id, variety.id);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(pickupBody(listing.id, 5))
        .expect(201);

      const body = res.body as { id: string; unitPrice: string };
      createdOrderIds.push(body.id);
      expect(body.unitPrice).toBe('50');
    });

    it('returns 400 for a delivery order without an addressId', async () => {
      const grower = await createUser(Role.GROWER, 'create-noaddr-grower');
      const customer = await createUser(Role.CUSTOMER, 'create-noaddr-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Beetroot');
      const variety = await createVariety(crop.id, 'Red Beet');
      const listing = await createListing(grower.id, crop.id, variety.id);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 2,
          deliveryMethod: DeliveryMethod.DELIVERY,
          paymentMethod: PaymentMethod.COD,
        })
        .expect(400);
    });

    it('returns 404 when the addressId does not belong to the buyer', async () => {
      const grower = await createUser(Role.GROWER, 'create-badaddr-grower');
      const customer = await createUser(Role.CUSTOMER, 'create-badaddr-cust');
      const otherCustomer = await createUser(
        Role.CUSTOMER,
        'create-badaddr-other',
      );
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Onion');
      const variety = await createVariety(crop.id, 'Red Onion');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const otherAddress = await createAddress(otherCustomer.id);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 2,
          deliveryMethod: DeliveryMethod.DELIVERY,
          addressId: otherAddress.id,
          paymentMethod: PaymentMethod.COD,
        })
        .expect(404);
    });

    it('creates a delivery order with a valid own address', async () => {
      const grower = await createUser(
        Role.GROWER,
        'create-gooddelivery-grower',
      );
      const customer = await createUser(
        Role.CUSTOMER,
        'create-gooddelivery-cust',
      );
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Garlic');
      const variety = await createVariety(crop.id, 'Common Garlic');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const address = await createAddress(customer.id);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 2,
          deliveryMethod: DeliveryMethod.DELIVERY,
          addressId: address.id,
          paymentMethod: PaymentMethod.COD,
        })
        .expect(201);

      const body = res.body as { id: string; addressId: string };
      createdOrderIds.push(body.id);
      expect(body.addressId).toBe(address.id);
    });
  });

  describe('GET /orders', () => {
    it("returns only the requesting buyer's own orders", async () => {
      const grower = await createUser(Role.GROWER, 'list-grower');
      const customerA = await createUser(Role.CUSTOMER, 'list-cust-a');
      const customerB = await createUser(Role.CUSTOMER, 'list-cust-b');
      const tokenA = await loginAndGetToken(customerA.email);
      const crop = await createCrop(grower.id, 'Pepper');
      const variety = await createVariety(crop.id, 'Bell Pepper');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const orderA = await createOrder(customerA.id, listing.id);
      const orderB = await createOrder(customerB.id, listing.id);

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((o) => o.id);
      expect(ids).toContain(orderA.id);
      expect(ids).not.toContain(orderB.id);
    });

    it('returns all orders for an Admin', async () => {
      const grower = await createUser(Role.GROWER, 'list-admin-grower');
      const customer = await createUser(Role.CUSTOMER, 'list-admin-cust');
      const admin = await createUser(Role.ADMIN, 'list-admin');
      const adminToken = await loginAndGetToken(admin.email);
      const crop = await createCrop(grower.id, 'Radish');
      const variety = await createVariety(crop.id, 'Red Radish');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((o) => o.id);
      expect(ids).toContain(order.id);
    });

    it("returns only orders on the requesting Grower's own listings", async () => {
      const growerA = await createUser(Role.GROWER, 'list-grower-a');
      const growerB = await createUser(Role.GROWER, 'list-grower-b');
      const customer = await createUser(Role.CUSTOMER, 'list-grower-cust');
      const tokenA = await loginAndGetToken(growerA.email);
      const cropA = await createCrop(growerA.id, 'Beans');
      const varietyA = await createVariety(cropA.id, 'Green Beans');
      const listingA = await createListing(growerA.id, cropA.id, varietyA.id);
      const cropB = await createCrop(growerB.id, 'Peas');
      const varietyB = await createVariety(cropB.id, 'Green Peas');
      const listingB = await createListing(growerB.id, cropB.id, varietyB.id);
      const orderOnA = await createOrder(customer.id, listingA.id);
      const orderOnB = await createOrder(customer.id, listingB.id);

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((o) => o.id);
      expect(ids).toContain(orderOnA.id);
      expect(ids).not.toContain(orderOnB.id);
    });
  });

  describe('GET /orders/:id', () => {
    it('returns 403 when a non-owner, non-Admin requests the order', async () => {
      const grower = await createUser(Role.GROWER, 'getone-grower');
      const owner = await createUser(Role.CUSTOMER, 'getone-owner');
      const stranger = await createUser(Role.CUSTOMER, 'getone-stranger');
      const strangerToken = await loginAndGetToken(stranger.email);
      const crop = await createCrop(grower.id, 'Cauliflower');
      const variety = await createVariety(crop.id, 'White Cauliflower');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(owner.id, listing.id);

      await request(app.getHttpServer())
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(403);
    });

    it("returns 200 for the order's own buyer", async () => {
      const grower = await createUser(Role.GROWER, 'getone-owner-grower');
      const owner = await createUser(Role.CUSTOMER, 'getone-owner-cust');
      const ownerToken = await loginAndGetToken(owner.email);
      const crop = await createCrop(grower.id, 'Brinjal');
      const variety = await createVariety(crop.id, 'Purple Brinjal');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(owner.id, listing.id);

      await request(app.getHttpServer())
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it("returns 403 for a Grower who does not own the order's listing", async () => {
      const growerA = await createUser(Role.GROWER, 'getone-grower-a');
      const growerB = await createUser(Role.GROWER, 'getone-grower-b');
      const customer = await createUser(Role.CUSTOMER, 'getone-grower-cust');
      const tokenA = await loginAndGetToken(growerA.email);
      const crop = await createCrop(growerB.id, 'Pumpkin');
      const variety = await createVariety(crop.id, 'Sugar Pumpkin');
      const listing = await createListing(growerB.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      await request(app.getHttpServer())
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });

    it("returns 200 for the Grower who owns the order's listing", async () => {
      const grower = await createUser(Role.GROWER, 'getone-grower-owner');
      const customer = await createUser(
        Role.CUSTOMER,
        'getone-grower-owner-cust',
      );
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Zucchini');
      const variety = await createVariety(crop.id, 'Green Zucchini');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      await request(app.getHttpServer())
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('returns 403 for a non-Grower', async () => {
      const grower = await createUser(Role.GROWER, 'status-nongrower-grower');
      const customer = await createUser(Role.CUSTOMER, 'status-nongrower-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Okra');
      const variety = await createVariety(crop.id, 'Green Okra');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it("returns 404 when the order's listing is not owned by the requesting Grower", async () => {
      const growerA = await createUser(Role.GROWER, 'status-notowned-a');
      const growerB = await createUser(Role.GROWER, 'status-notowned-b');
      const customer = await createUser(Role.CUSTOMER, 'status-notowned-cust');
      const tokenA = await loginAndGetToken(growerA.email);
      const crop = await createCrop(growerB.id, 'Ginger');
      const variety = await createVariety(crop.id, 'Fresh Ginger');
      const listing = await createListing(growerB.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('advances a pickup order through to PICKED_UP and then rejects further advances', async () => {
      const grower = await createUser(Role.GROWER, 'status-pickup-grower');
      const customer = await createUser(Role.CUSTOMER, 'status-pickup-cust');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Lettuce');
      const variety = await createVariety(crop.id, 'Iceberg');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      const toConfirmed = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((toConfirmed.body as { status: string }).status).toBe(
        OrderStatus.CONFIRMED,
      );

      const toReady = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((toReady.body as { status: string }).status).toBe(
        OrderStatus.READY_FOR_PICKUP,
      );

      const toPickedUp = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((toPickedUp.body as { status: string }).status).toBe(
        OrderStatus.PICKED_UP,
      );

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });
  });

  describe('OrderStatusHistory (Mongo)', () => {
    it('logs a PLACED entry on creation and a CONFIRMED entry on advance, returned chronologically on GET /orders/:id', async () => {
      const grower = await createUser(Role.GROWER, 'history-grower');
      const customer = await createUser(Role.CUSTOMER, 'history-cust');
      const growerToken = await loginAndGetToken(grower.email);
      const customerToken = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Mint');
      const variety = await createVariety(crop.id, 'Spearmint');
      const listing = await createListing(grower.id, crop.id, variety.id);

      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(pickupBody(listing.id, 2))
        .expect(201);
      const orderId = (createRes.body as { id: string }).id;
      createdOrderIds.push(orderId);

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${growerToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const body = res.body as {
        statusHistory: Array<{ status: string; changedBy: string }>;
      };
      expect(body.statusHistory).toHaveLength(2);
      expect(body.statusHistory[0]).toMatchObject({
        status: OrderStatus.PLACED,
        changedBy: customer.id,
      });
      expect(body.statusHistory[1]).toMatchObject({
        status: OrderStatus.CONFIRMED,
        changedBy: grower.id,
      });
    });
  });

  describe('PATCH /orders/:id/cancel', () => {
    it('cancels a PLACED order and releases its quantity back to the listing', async () => {
      const grower = await createUser(Role.GROWER, 'cancel-grower');
      const customer = await createUser(Role.CUSTOMER, 'cancel-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Cabbage');
      const variety = await createVariety(crop.id, 'Green Cabbage');
      const listing = await createListing(grower.id, crop.id, variety.id, {
        availableQuantity: 90,
      });
      const order = await createOrder(customer.id, listing.id, {
        quantity: 10,
      });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((res.body as { status: string }).status).toBe(
        OrderStatus.CANCELLED,
      );

      const updatedListing = await prisma.listing.findUniqueOrThrow({
        where: { id: listing.id },
      });
      expect(updatedListing.availableQuantity.toNumber()).toBe(100);
    });

    it('returns 409 once the order is past a cancellable status', async () => {
      const grower = await createUser(Role.GROWER, 'cancel-late-grower');
      const customer = await createUser(Role.CUSTOMER, 'cancel-late-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Broccoli');
      const variety = await createVariety(crop.id, 'Green Broccoli');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id, {
        quantity: 5,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
      });

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });
  });

  describe('PATCH /orders/:id/dispute', () => {
    it('returns 403 for a non-Admin', async () => {
      const grower = await createUser(Role.GROWER, 'dispute-nonadmin-grower');
      const customer = await createUser(Role.CUSTOMER, 'dispute-nonadmin-cust');
      const token = await loginAndGetToken(customer.email);
      const crop = await createCrop(grower.id, 'Zucchini');
      const variety = await createVariety(crop.id, 'Green Zucchini');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/dispute`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(403);
    });

    it('force-sets the status and releases stock when the Admin forces CANCELLED', async () => {
      const grower = await createUser(Role.GROWER, 'dispute-admin-grower');
      const customer = await createUser(Role.CUSTOMER, 'dispute-admin-cust');
      const admin = await createUser(Role.ADMIN, 'dispute-admin');
      const adminToken = await loginAndGetToken(admin.email);
      const crop = await createCrop(grower.id, 'Pumpkin');
      const variety = await createVariety(crop.id, 'Sugar Pumpkin');
      const listing = await createListing(grower.id, crop.id, variety.id, {
        availableQuantity: 90,
      });
      const order = await createOrder(customer.id, listing.id, {
        quantity: 10,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
      });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/dispute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.CANCELLED })
        .expect(200);
      expect((res.body as { status: string }).status).toBe(
        OrderStatus.CANCELLED,
      );

      const updatedListing = await prisma.listing.findUniqueOrThrow({
        where: { id: listing.id },
      });
      expect(updatedListing.availableQuantity.toNumber()).toBe(100);
    });

    it('returns 400 when the Admin attempts to force any status other than CANCELLED', async () => {
      const grower = await createUser(Role.GROWER, 'dispute-badstatus-grower');
      const customer = await createUser(
        Role.CUSTOMER,
        'dispute-badstatus-cust',
      );
      const admin = await createUser(Role.ADMIN, 'dispute-badstatus-admin');
      const adminToken = await loginAndGetToken(admin.email);
      const crop = await createCrop(grower.id, 'Radish');
      const variety = await createVariety(crop.id, 'Red Radish');
      const listing = await createListing(grower.id, crop.id, variety.id);
      const order = await createOrder(customer.id, listing.id);

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/dispute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(400);
    });
  });

  describe('POST /orders with ONLINE/UPI payment', () => {
    beforeEach(() => {
      mockRazorpayClient.createOrder.mockReset();
    });

    it('creates an OrderIntent and a Razorpay payment intent, without creating an Order or decrementing stock', async () => {
      const customer = await createUser(Role.CUSTOMER, 'intent-happy');
      const token = await loginAndGetToken(customer.email);
      const grower = await createUser(Role.GROWER, 'intent-happy-grower');
      const crop = await createCrop(grower.id, 'Crop intent-happy');
      const variety = await createVariety(crop.id, 'Variety intent-happy');
      const listing = await createListing(grower.id, crop.id, variety.id);

      mockRazorpayClient.createOrder.mockResolvedValue({
        id: 'order_direct_intent',
        amount: 25000,
        currency: 'INR',
      });

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 5,
          deliveryMethod: DeliveryMethod.PICKUP,
          paymentMethod: PaymentMethod.ONLINE,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        razorpayOrderId: 'order_direct_intent',
        amount: 250,
        currency: 'INR',
      });
      const orderIntentId = (res.body as { orderIntentId: string })
        .orderIntentId;
      expect(orderIntentId).toBeDefined();
      createdOrderIntentIds.push(orderIntentId);

      const ordersForListing = await prisma.order.findMany({
        where: { listingId: listing.id },
      });
      expect(ordersForListing).toHaveLength(0);
      const updatedListing = await prisma.listing.findUniqueOrThrow({
        where: { id: listing.id },
      });
      expect(updatedListing.availableQuantity.toNumber()).toBe(100);
    });
  });

  describe('POST /orders/verify-payment', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/orders/verify-payment')
        .send({
          orderIntentId: 'irrelevant',
          razorpayOrderId: 'x',
          razorpayPaymentId: 'y',
          razorpaySignature: 'z',
        })
        .expect(401);
    });

    it('marks the Payment SUCCESS when the signature is valid', async () => {
      const customer = await createUser(Role.CUSTOMER, 'verify-happy');
      const token = await loginAndGetToken(customer.email);
      const grower = await createUser(Role.GROWER, 'verify-happy-grower');
      const crop = await createCrop(grower.id, 'Crop verify-happy');
      const variety = await createVariety(crop.id, 'Variety verify-happy');
      const listing = await createListing(grower.id, crop.id, variety.id);
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
      await prisma.payment.create({
        data: {
          orderIntentId: intent.id,
          amount: 250,
          method: PaymentMethod.ONLINE,
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
        .post('/orders/verify-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderIntentId: intent.id,
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
