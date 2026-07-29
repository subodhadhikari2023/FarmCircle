import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../generated/prisma/enums';

describe('CatalogModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
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

  describe('POST /crops', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/crops')
        .send({ name: 'Tomato' })
        .expect(401);
    });

    it('returns 403 for a non-Grower', async () => {
      const vendor = await createUser(Role.VENDOR, 'create-nongrower');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .post('/crops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tomato' })
        .expect(403);
    });

    it('creates a crop owned by the requesting Grower', async () => {
      const grower = await createUser(Role.GROWER, 'create-grower');
      const token = await loginAndGetToken(grower.email);

      const res = await request(app.getHttpServer())
        .post('/crops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tomato' })
        .expect(201);

      const body = res.body as { id: string; name: string; ownerId: string };
      createdCropIds.push(body.id);
      expect(body).toMatchObject({ name: 'Tomato', ownerId: grower.id });
    });

    it('returns 409 for a duplicate crop name owned by the same Grower', async () => {
      const grower = await createUser(Role.GROWER, 'create-dup');
      const token = await loginAndGetToken(grower.email);
      await createCrop(grower.id, 'Potato');

      await request(app.getHttpServer())
        .post('/crops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Potato' })
        .expect(409);
    });
  });

  describe('GET /crops and GET /crops/:id', () => {
    it("only lists the requesting Grower's own crops", async () => {
      const growerA = await createUser(Role.GROWER, 'list-a');
      const growerB = await createUser(Role.GROWER, 'list-b');
      const cropA = await createCrop(growerA.id, 'Carrot A');
      const cropB = await createCrop(growerB.id, 'Carrot B');
      const token = await loginAndGetToken(growerA.email);

      const res = await request(app.getHttpServer())
        .get('/crops')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = (res.body as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(cropA.id);
      expect(ids).not.toContain(cropB.id);
    });

    it('returns 404 for a crop owned by a different Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'getone-a');
      const growerB = await createUser(Role.GROWER, 'getone-b');
      const cropB = await createCrop(growerB.id, 'Onion');
      const token = await loginAndGetToken(growerA.email);

      await request(app.getHttpServer())
        .get(`/crops/${cropB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /crops/:id', () => {
    it('updates the crop name', async () => {
      const grower = await createUser(Role.GROWER, 'patch-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Cabbage');

      const res = await request(app.getHttpServer())
        .patch(`/crops/${crop.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Red Cabbage' })
        .expect(200);

      expect((res.body as { name: string }).name).toBe('Red Cabbage');
    });
  });

  describe('DELETE /crops/:id', () => {
    it('deletes a crop with no dependents', async () => {
      const grower = await createUser(Role.GROWER, 'delete-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Spinach');

      await request(app.getHttpServer())
        .delete(`/crops/${crop.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('returns 409 for a crop with a dependent variety', async () => {
      const grower = await createUser(Role.GROWER, 'delete-inuse');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Kale');
      await createVariety(crop.id, 'Curly');

      await request(app.getHttpServer())
        .delete(`/crops/${crop.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });
  });

  describe('POST /crops/:id/varieties and GET /crops/:id/varieties', () => {
    it('returns 404 when the crop is not owned by the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'variety-a');
      const growerB = await createUser(Role.GROWER, 'variety-b');
      const cropB = await createCrop(growerB.id, 'Pepper');
      const token = await loginAndGetToken(growerA.email);

      await request(app.getHttpServer())
        .post(`/crops/${cropB.id}/varieties`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bell' })
        .expect(404);
    });

    it('creates and lists varieties under a crop', async () => {
      const grower = await createUser(Role.GROWER, 'variety-owner');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Chili');

      const createRes = await request(app.getHttpServer())
        .post(`/crops/${crop.id}/varieties`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Jalapeno' })
        .expect(201);
      const body = createRes.body as { id: string; name: string };
      createdVarietyIds.push(body.id);

      const listRes = await request(app.getHttpServer())
        .get(`/crops/${crop.id}/varieties`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const names = (listRes.body as Array<{ name: string }>).map(
        (v) => v.name,
      );
      expect(names).toContain('Jalapeno');
    });
  });

  describe('PATCH /varieties/:id and DELETE /varieties/:id', () => {
    it('updates a variety name', async () => {
      const grower = await createUser(Role.GROWER, 'variety-patch');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Squash');
      const variety = await createVariety(crop.id, 'Butternut');

      const res = await request(app.getHttpServer())
        .patch(`/varieties/${variety.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acorn' })
        .expect(200);

      expect((res.body as { name: string }).name).toBe('Acorn');
    });

    it("returns 404 when updating a variety under another Grower's crop", async () => {
      const growerA = await createUser(Role.GROWER, 'variety-patch-a');
      const growerB = await createUser(Role.GROWER, 'variety-patch-b');
      const token = await loginAndGetToken(growerA.email);
      const cropB = await createCrop(growerB.id, 'Zucchini');
      const varietyB = await createVariety(cropB.id, 'Green');

      await request(app.getHttpServer())
        .patch(`/varieties/${varietyB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Yellow' })
        .expect(404);
    });

    it('deletes a variety with no dependents', async () => {
      const grower = await createUser(Role.GROWER, 'variety-delete');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Cucumber');
      const variety = await createVariety(crop.id, 'Pickling');

      await request(app.getHttpServer())
        .delete(`/varieties/${variety.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });
});
