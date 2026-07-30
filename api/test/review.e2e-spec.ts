import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  Role,
} from './../generated/prisma/enums';

describe('ReviewModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdReviewIds: string[] = [];
  const PASSWORD = 'Test-Password-123';

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
  ) {
    const listing = await prisma.listing.create({
      data: {
        ownerId,
        cropId,
        varietyId,
        hasTrackedCycle: false,
        retailPrice: 50,
        wholesalePrice: 35,
        minWholesaleQty: 15,
        retailCeilingPercent: 10,
        preBookablePercent: 60,
        availableQuantity: 100,
        isPublished: true,
        isClosed: false,
      },
    });
    createdListingIds.push(listing.id);
    return listing;
  }

  async function createOrder(
    buyerId: string,
    listingId: string,
    status: OrderStatus,
  ) {
    const order = await prisma.order.create({
      data: {
        buyerId,
        listingId,
        quantity: 5,
        unitPrice: 50,
        totalAmount: 250,
        deliveryMethod: DeliveryMethod.PICKUP,
        paymentMethod: PaymentMethod.COD,
        status,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  async function createFulfillableSetup(label: string, status: OrderStatus) {
    const grower = await createUser(Role.GROWER, `${label}-grower`);
    const buyer = await createUser(Role.CUSTOMER, `${label}-buyer`);
    const buyerToken = await loginAndGetToken(buyer.email);
    const crop = await createCrop(grower.id, `Crop ${label}`);
    const variety = await createVariety(crop.id, `Variety ${label}`);
    const listing = await createListing(grower.id, crop.id, variety.id);
    const order = await createOrder(buyer.id, listing.id, status);
    return { grower, buyer, buyerToken, crop, variety, listing, order };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  afterAll(async () => {
    if (createdReviewIds.length > 0) {
      await prisma.review.deleteMany({
        where: { id: { in: createdReviewIds } },
      });
    }
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
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

  describe('POST /reviews', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/reviews')
        .send({ orderId: 'irrelevant', rating: 5 })
        .expect(401);
    });

    it('returns 403 for a Grower', async () => {
      const grower = await createUser(Role.GROWER, 'create-nongrower');
      const token = await loginAndGetToken(grower.email);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: 'irrelevant', rating: 5 })
        .expect(403);
    });

    it('returns 404 when the order does not exist', async () => {
      const customer = await createUser(Role.CUSTOMER, 'create-noorder');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderId: '00000000-0000-0000-0000-000000000000',
          rating: 5,
        })
        .expect(404);
    });

    it('returns 404 when the order is not owned by the requester', async () => {
      const setup = await createFulfillableSetup(
        'create-notowned',
        OrderStatus.DELIVERED,
      );
      const otherCustomer = await createUser(Role.CUSTOMER, 'create-other');
      const otherToken = await loginAndGetToken(otherCustomer.email);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(404);
    });

    it('returns 409 when the order has not been fulfilled yet', async () => {
      const setup = await createFulfillableSetup(
        'create-notfulfilled',
        OrderStatus.PLACED,
      );

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(409);
    });

    it('creates a review for a delivered order', async () => {
      const setup = await createFulfillableSetup(
        'create-delivered',
        OrderStatus.DELIVERED,
      );

      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 4, comment: 'Fresh produce' })
        .expect(201);
      const body = res.body as {
        id: string;
        growerId: string;
        rating: number;
      };
      expect(body.growerId).toBe(setup.grower.id);
      expect(body.rating).toBe(4);
      createdReviewIds.push(body.id);
    });

    it('creates a review for a picked-up order', async () => {
      const setup = await createFulfillableSetup(
        'create-pickedup',
        OrderStatus.PICKED_UP,
      );

      const res = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 3 })
        .expect(201);
      createdReviewIds.push((res.body as { id: string }).id);
    });

    it('returns 409 when the order has already been reviewed', async () => {
      const setup = await createFulfillableSetup(
        'create-duplicate',
        OrderStatus.DELIVERED,
      );

      const first = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(201);
      createdReviewIds.push((first.body as { id: string }).id);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 2 })
        .expect(409);
    });
  });

  describe('GET /reviews', () => {
    it('lists non-hidden reviews without requiring authentication', async () => {
      const setup = await createFulfillableSetup(
        'list-happy',
        OrderStatus.DELIVERED,
      );
      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(201);
      const reviewId = (created.body as { id: string }).id;
      createdReviewIds.push(reviewId);

      const res = await request(app.getHttpServer())
        .get('/reviews')
        .expect(200);
      expect((res.body as Array<{ id: string }>).map((r) => r.id)).toContain(
        reviewId,
      );
    });

    it('excludes reviews an Admin has hidden', async () => {
      const setup = await createFulfillableSetup(
        'list-hidden',
        OrderStatus.DELIVERED,
      );
      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 1 })
        .expect(201);
      const reviewId = (created.body as { id: string }).id;
      createdReviewIds.push(reviewId);

      const admin = await createUser(Role.ADMIN, 'list-hidden-admin');
      const adminToken = await loginAndGetToken(admin.email);
      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/reviews')
        .expect(200);
      expect(
        (res.body as Array<{ id: string }>).map((r) => r.id),
      ).not.toContain(reviewId);
    });
  });

  describe('GET /reviews/:id', () => {
    it('returns 404 for an unknown review', async () => {
      await request(app.getHttpServer())
        .get('/reviews/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns a review without requiring authentication', async () => {
      const setup = await createFulfillableSetup(
        'getone-happy',
        OrderStatus.DELIVERED,
      );
      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(201);
      const reviewId = (created.body as { id: string }).id;
      createdReviewIds.push(reviewId);

      await request(app.getHttpServer())
        .get(`/reviews/${reviewId}`)
        .expect(200);
    });

    it('returns 404 for a review an Admin has hidden', async () => {
      const setup = await createFulfillableSetup(
        'getone-hidden',
        OrderStatus.DELIVERED,
      );
      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(201);
      const reviewId = (created.body as { id: string }).id;
      createdReviewIds.push(reviewId);

      const admin = await createUser(Role.ADMIN, 'getone-hidden-admin');
      const adminToken = await loginAndGetToken(admin.email);
      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/reviews/${reviewId}`)
        .expect(404);
    });
  });

  describe('PATCH /reviews/:id/hide', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .patch('/reviews/irrelevant/hide')
        .expect(401);
    });

    it('returns 403 for a non-Admin', async () => {
      const setup = await createFulfillableSetup(
        'hide-nonadmin',
        OrderStatus.DELIVERED,
      );
      const created = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .send({ orderId: setup.order.id, rating: 5 })
        .expect(201);
      const reviewId = (created.body as { id: string }).id;
      createdReviewIds.push(reviewId);

      await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}/hide`)
        .set('Authorization', `Bearer ${setup.buyerToken}`)
        .expect(403);
    });

    it('returns 404 for an unknown review', async () => {
      const admin = await createUser(Role.ADMIN, 'hide-unknown-admin');
      const adminToken = await loginAndGetToken(admin.email);

      await request(app.getHttpServer())
        .patch('/reviews/00000000-0000-0000-0000-000000000000/hide')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
