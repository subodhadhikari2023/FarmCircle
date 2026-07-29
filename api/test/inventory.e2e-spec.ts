import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../generated/prisma/enums';

describe('InventoryModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
  const createdCycleIds: string[] = [];
  const createdBatchIds: string[] = [];
  const createdListingIds: string[] = [];
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

  async function createCycle(ownerId: string, cropId: string, name: string) {
    const cycle = await prisma.cycle.create({
      data: { ownerId, cropId, name },
    });
    createdCycleIds.push(cycle.id);
    return cycle;
  }

  async function createBatch(
    ownerId: string,
    cropId: string,
    varietyId: string,
    cycleId: string,
    harvestConfirmed: boolean,
  ) {
    const batch = await prisma.batch.create({
      data: {
        ownerId,
        cropId,
        varietyId,
        cycleId,
        quantity: 100,
        predictedYield: 80,
        harvestConfirmed,
      },
    });
    createdBatchIds.push(batch.id);
    return batch;
  }

  async function createListing(
    ownerId: string,
    cropId: string,
    varietyId: string,
    overrides: Partial<{ isPublished: boolean; isClosed: boolean }> = {},
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
        isPublished: overrides.isPublished ?? true,
        isClosed: overrides.isClosed ?? false,
      },
    });
    createdListingIds.push(listing.id);
    return listing;
  }

  const validCreateBody = (crop: { id: string }, variety: { id: string }) => ({
    cropId: crop.id,
    varietyId: variety.id,
    retailPrice: 50,
    wholesalePrice: 35,
    minWholesaleQty: 15,
    retailCeilingPercent: 10,
    preBookablePercent: 60,
    availableQuantity: 100,
  });

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
    if (createdListingIds.length > 0) {
      await prisma.listing.deleteMany({
        where: { id: { in: createdListingIds } },
      });
    }
    if (createdBatchIds.length > 0) {
      await prisma.batch.deleteMany({
        where: { id: { in: createdBatchIds } },
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

  describe('POST /inventory', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/inventory')
        .send({
          cropId: 'irrelevant',
          varietyId: 'irrelevant',
          retailPrice: 50,
          wholesalePrice: 35,
          minWholesaleQty: 15,
          retailCeilingPercent: 10,
          preBookablePercent: 60,
          availableQuantity: 100,
        })
        .expect(401);
    });

    it('returns 403 for a non-Grower', async () => {
      const vendor = await createUser(Role.VENDOR, 'create-nongrower');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .post('/inventory')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cropId: 'irrelevant',
          varietyId: 'irrelevant',
          retailPrice: 50,
          wholesalePrice: 35,
          minWholesaleQty: 15,
          retailCeilingPercent: 10,
          preBookablePercent: 60,
          availableQuantity: 100,
        })
        .expect(403);
    });

    it('returns 404 when the cropId does not belong to the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'create-a');
      const growerB = await createUser(Role.GROWER, 'create-b');
      const cropB = await createCrop(growerB.id, 'Tomato B');
      const varietyB = await createVariety(cropB.id, 'Roma B');
      const token = await loginAndGetToken(growerA.email);

      await request(app.getHttpServer())
        .post('/inventory')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody(cropB, varietyB))
        .expect(404);
    });

    it('returns 404 when the variety does not belong to the crop', async () => {
      const grower = await createUser(Role.GROWER, 'create-badvariety');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Carrot');
      const otherCrop = await createCrop(grower.id, 'Other Crop');
      const otherVariety = await createVariety(otherCrop.id, 'Other Variety');

      await request(app.getHttpServer())
        .post('/inventory')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody(crop, otherVariety))
        .expect(404);
    });

    it('returns 400 when retailCeilingPercent is outside the 5-20 bound', async () => {
      const grower = await createUser(Role.GROWER, 'create-badbound');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Pepper');
      const variety = await createVariety(crop.id, 'Bell Pepper');

      await request(app.getHttpServer())
        .post('/inventory')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validCreateBody(crop, variety), retailCeilingPercent: 25 })
        .expect(400);
    });

    it('creates a published direct-path listing', async () => {
      const grower = await createUser(Role.GROWER, 'create-happy');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Spinach');
      const variety = await createVariety(crop.id, 'Baby Spinach');

      const res = await request(app.getHttpServer())
        .post('/inventory')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody(crop, variety))
        .expect(201);

      const body = res.body as {
        id: string;
        isPublished: boolean;
        hasTrackedCycle: boolean;
        wholesalePrice: string;
      };
      createdListingIds.push(body.id);
      expect(body.isPublished).toBe(true);
      expect(body.hasTrackedCycle).toBe(false);
      expect(body.wholesalePrice).toBeDefined();
    });
  });

  describe('GET /inventory', () => {
    it('lists only published, open listings, hiding wholesale fields from anonymous requests', async () => {
      const grower = await createUser(Role.GROWER, 'list-grower');
      const crop = await createCrop(grower.id, 'Kale');
      const variety = await createVariety(crop.id, 'Curly Kale');
      const openListing = await createListing(grower.id, crop.id, variety.id);
      const unpublishedListing = await createListing(
        grower.id,
        crop.id,
        variety.id,
        { isPublished: false },
      );
      const closedListing = await createListing(
        grower.id,
        crop.id,
        variety.id,
        { isClosed: true },
      );

      const res = await request(app.getHttpServer())
        .get('/inventory')
        .expect(200);
      const body = res.body as Array<{ id: string; wholesalePrice?: string }>;
      const ids = body.map((l) => l.id);
      expect(ids).toContain(openListing.id);
      expect(ids).not.toContain(unpublishedListing.id);
      expect(ids).not.toContain(closedListing.id);
      const found = body.find((l) => l.id === openListing.id);
      expect(found?.wholesalePrice).toBeUndefined();
    });

    it('includes wholesale fields for an authenticated Vendor', async () => {
      const grower = await createUser(Role.GROWER, 'list-vendor-grower');
      const vendor = await createUser(Role.VENDOR, 'list-vendor');
      const token = await loginAndGetToken(vendor.email);
      const crop = await createCrop(grower.id, 'Lettuce');
      const variety = await createVariety(crop.id, 'Iceberg');
      await createListing(grower.id, crop.id, variety.id);

      const res = await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as Array<{ wholesalePrice?: string }>;
      expect(body.some((l) => l.wholesalePrice !== undefined)).toBe(true);
    });
  });

  describe('GET /inventory/:id', () => {
    it('returns 404 for an unpublished listing', async () => {
      const grower = await createUser(Role.GROWER, 'getone-unpublished');
      const crop = await createCrop(grower.id, 'Radish');
      const variety = await createVariety(crop.id, 'Red Radish');
      const listing = await createListing(grower.id, crop.id, variety.id, {
        isPublished: false,
      });

      await request(app.getHttpServer())
        .get(`/inventory/${listing.id}`)
        .expect(404);
    });

    it('hides wholesale fields from a Customer and shows them to a Vendor', async () => {
      const grower = await createUser(Role.GROWER, 'getone-grower');
      const customer = await createUser(Role.CUSTOMER, 'getone-customer');
      const vendor = await createUser(Role.VENDOR, 'getone-vendor');
      const customerToken = await loginAndGetToken(customer.email);
      const vendorToken = await loginAndGetToken(vendor.email);
      const crop = await createCrop(grower.id, 'Beetroot');
      const variety = await createVariety(crop.id, 'Red Beet');
      const listing = await createListing(grower.id, crop.id, variety.id);

      const customerRes = await request(app.getHttpServer())
        .get(`/inventory/${listing.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(
        (customerRes.body as { wholesalePrice?: string }).wholesalePrice,
      ).toBeUndefined();

      const vendorRes = await request(app.getHttpServer())
        .get(`/inventory/${listing.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);
      expect(
        (vendorRes.body as { wholesalePrice?: string }).wholesalePrice,
      ).toBeDefined();
    });
  });

  describe('GET /inventory/upcoming', () => {
    it('returns 401 without a token and 403 for a non-Vendor', async () => {
      await request(app.getHttpServer()).get('/inventory/upcoming').expect(401);

      const customer = await createUser(Role.CUSTOMER, 'upcoming-nonvendor');
      const token = await loginAndGetToken(customer.email);
      await request(app.getHttpServer())
        .get('/inventory/upcoming')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns only batches whose harvest has not been confirmed', async () => {
      const grower = await createUser(Role.GROWER, 'upcoming-grower');
      const vendor = await createUser(Role.VENDOR, 'upcoming-vendor');
      const token = await loginAndGetToken(vendor.email);
      const crop = await createCrop(grower.id, 'Okra');
      const variety = await createVariety(crop.id, 'Green Okra');
      const cycle = await createCycle(grower.id, crop.id, 'Okra Cycle');
      const growingBatch = await createBatch(
        grower.id,
        crop.id,
        variety.id,
        cycle.id,
        false,
      );
      const harvestedBatch = await createBatch(
        grower.id,
        crop.id,
        variety.id,
        cycle.id,
        true,
      );

      const res = await request(app.getHttpServer())
        .get('/inventory/upcoming')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((b) => b.id);
      expect(ids).toContain(growingBatch.id);
      expect(ids).not.toContain(harvestedBatch.id);
    });
  });

  describe('PATCH /inventory/:id', () => {
    it("updates the listing's available quantity", async () => {
      const grower = await createUser(Role.GROWER, 'patch-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Cauliflower');
      const variety = await createVariety(crop.id, 'White Cauliflower');
      const listing = await createListing(grower.id, crop.id, variety.id);

      const res = await request(app.getHttpServer())
        .patch(`/inventory/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ availableQuantity: 42 })
        .expect(200);
      expect(
        (res.body as { availableQuantity: string }).availableQuantity,
      ).toBe('42');
    });

    it('returns 400 when attempting to edit a locked price field', async () => {
      const grower = await createUser(Role.GROWER, 'patch-lockedprice');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Brinjal');
      const variety = await createVariety(crop.id, 'Purple Brinjal');
      const listing = await createListing(grower.id, crop.id, variety.id);

      await request(app.getHttpServer())
        .patch(`/inventory/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ retailPrice: 999 })
        .expect(400);
    });

    it('returns 404 for a listing not owned by the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'patch-notowned-a');
      const growerB = await createUser(Role.GROWER, 'patch-notowned-b');
      const tokenA = await loginAndGetToken(growerA.email);
      const crop = await createCrop(growerB.id, 'Onion');
      const variety = await createVariety(crop.id, 'Red Onion');
      const listing = await createListing(growerB.id, crop.id, variety.id);

      await request(app.getHttpServer())
        .patch(`/inventory/${listing.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ availableQuantity: 10 })
        .expect(404);
    });
  });

  describe('PATCH /inventory/:id/close', () => {
    it('closes an open listing and rejects a second close', async () => {
      const grower = await createUser(Role.GROWER, 'close-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Garlic');
      const variety = await createVariety(crop.id, 'Common Garlic');
      const listing = await createListing(grower.id, crop.id, variety.id);

      const res = await request(app.getHttpServer())
        .patch(`/inventory/${listing.id}/close`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((res.body as { isClosed: boolean }).isClosed).toBe(true);

      await request(app.getHttpServer())
        .patch(`/inventory/${listing.id}/close`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('returns 404 for a listing not owned by the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'close-notowned-a');
      const growerB = await createUser(Role.GROWER, 'close-notowned-b');
      const tokenA = await loginAndGetToken(growerA.email);
      const crop = await createCrop(growerB.id, 'Ginger');
      const variety = await createVariety(crop.id, 'Fresh Ginger');
      const listing = await createListing(growerB.id, crop.id, variety.id);

      await request(app.getHttpServer())
        .patch(`/inventory/${listing.id}/close`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });
});
