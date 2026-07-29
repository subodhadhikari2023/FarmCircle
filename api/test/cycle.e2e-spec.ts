import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../generated/prisma/enums';

describe('CycleModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdCycleIds: string[] = [];
  const createdMilestoneIds: string[] = [];
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
    if (createdCropIds.length > 0) {
      await prisma.crop.deleteMany({ where: { id: { in: createdCropIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  describe('POST /cycles', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/cycles')
        .send({ cropId: 'irrelevant', name: 'Standard' })
        .expect(401);
    });

    it('returns 403 for a non-Grower', async () => {
      const vendor = await createUser(Role.VENDOR, 'create-nongrower');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .post('/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({ cropId: 'irrelevant', name: 'Standard' })
        .expect(403);
    });

    it('returns 404 when the cropId does not belong to the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'create-a');
      const growerB = await createUser(Role.GROWER, 'create-b');
      const cropB = await createCrop(growerB.id, 'Tomato B');
      const token = await loginAndGetToken(growerA.email);

      await request(app.getHttpServer())
        .post('/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({ cropId: cropB.id, name: 'Standard' })
        .expect(404);
    });

    it('creates a cycle owned by the requesting Grower', async () => {
      const grower = await createUser(Role.GROWER, 'create-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Tomato');

      const res = await request(app.getHttpServer())
        .post('/cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({ cropId: crop.id, name: 'Standard Tomato Cycle' })
        .expect(201);

      const body = res.body as { id: string; ownerId: string; name: string };
      createdCycleIds.push(body.id);
      expect(body).toMatchObject({
        ownerId: grower.id,
        cropId: crop.id,
        name: 'Standard Tomato Cycle',
      });
    });
  });

  describe('GET /cycles and GET /cycles/:id', () => {
    it("only lists the requesting Grower's own cycles, optionally filtered by cropId", async () => {
      const growerA = await createUser(Role.GROWER, 'list-a');
      const growerB = await createUser(Role.GROWER, 'list-b');
      const cropA1 = await createCrop(growerA.id, 'Carrot A1');
      const cropA2 = await createCrop(growerA.id, 'Carrot A2');
      const cropB = await createCrop(growerB.id, 'Carrot B');
      const cycleA1 = await createCycle(growerA.id, cropA1.id, 'Cycle A1');
      await createCycle(growerA.id, cropA2.id, 'Cycle A2');
      await createCycle(growerB.id, cropB.id, 'Cycle B');
      const token = await loginAndGetToken(growerA.email);

      const allRes = await request(app.getHttpServer())
        .get('/cycles')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const allIds = (allRes.body as Array<{ id: string }>).map((c) => c.id);
      expect(allIds).toHaveLength(2);

      const filteredRes = await request(app.getHttpServer())
        .get(`/cycles?cropId=${cropA1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const filteredIds = (filteredRes.body as Array<{ id: string }>).map(
        (c) => c.id,
      );
      expect(filteredIds).toEqual([cycleA1.id]);
    });

    it('returns the cycle with its milestones ordered, and 404 for another Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'getone-a');
      const growerB = await createUser(Role.GROWER, 'getone-b');
      const crop = await createCrop(growerA.id, 'Pepper');
      const cycle = await createCycle(growerA.id, crop.id, 'Pepper Cycle');
      await createMilestone(cycle.id, 'Flowering', 2, 20);
      await createMilestone(cycle.id, 'Sown', 1, 10);
      const tokenA = await loginAndGetToken(growerA.email);
      const tokenB = await loginAndGetToken(growerB.email);

      const res = await request(app.getHttpServer())
        .get(`/cycles/${cycle.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const milestoneNames = (
        res.body as { milestones: Array<{ name: string }> }
      ).milestones.map((m) => m.name);
      expect(milestoneNames).toEqual(['Sown', 'Flowering']);

      await request(app.getHttpServer())
        .get(`/cycles/${cycle.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe('PATCH /cycles/:id', () => {
    it('updates the cycle name', async () => {
      const grower = await createUser(Role.GROWER, 'patch-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Cabbage');
      const cycle = await createCycle(grower.id, crop.id, 'Cabbage Cycle');

      const res = await request(app.getHttpServer())
        .patch(`/cycles/${cycle.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Fast-track Cabbage Cycle' })
        .expect(200);

      expect((res.body as { name: string }).name).toBe(
        'Fast-track Cabbage Cycle',
      );
    });
  });

  describe('DELETE /cycles/:id', () => {
    it('deletes a cycle and its milestones', async () => {
      const grower = await createUser(Role.GROWER, 'delete-grower');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Spinach');
      const cycle = await createCycle(grower.id, crop.id, 'Spinach Cycle');
      const milestone = await createMilestone(cycle.id, 'Sown', 1, 10);

      await request(app.getHttpServer())
        .delete(`/cycles/${cycle.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const remainingMilestone = await prisma.milestone.findUnique({
        where: { id: milestone.id },
      });
      expect(remainingMilestone).toBeNull();
      createdMilestoneIds.splice(createdMilestoneIds.indexOf(milestone.id), 1);
      createdCycleIds.splice(createdCycleIds.indexOf(cycle.id), 1);
    });
  });

  describe('POST /cycles/:id/milestones', () => {
    it('returns 404 when the cycle is not owned by the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'milestone-a');
      const growerB = await createUser(Role.GROWER, 'milestone-b');
      const cropB = await createCrop(growerB.id, 'Chili B');
      const cycleB = await createCycle(growerB.id, cropB.id, 'Chili Cycle B');
      const token = await loginAndGetToken(growerA.email);

      await request(app.getHttpServer())
        .post(`/cycles/${cycleB.id}/milestones`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sown', order: 1, expectedDurationDays: 10 })
        .expect(404);
    });

    it('creates a milestone and returns 409 for a duplicate order in the same cycle', async () => {
      const grower = await createUser(Role.GROWER, 'milestone-owner');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Chili');
      const cycle = await createCycle(grower.id, crop.id, 'Chili Cycle');

      const createRes = await request(app.getHttpServer())
        .post(`/cycles/${cycle.id}/milestones`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sown', order: 1, expectedDurationDays: 10 })
        .expect(201);
      const body = createRes.body as { id: string };
      createdMilestoneIds.push(body.id);

      await request(app.getHttpServer())
        .post(`/cycles/${cycle.id}/milestones`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Germinated', order: 1, expectedDurationDays: 5 })
        .expect(409);
    });
  });

  describe('PATCH /milestones/:id and DELETE /milestones/:id', () => {
    it('updates a milestone and returns 404 for another Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'milestone-patch-a');
      const growerB = await createUser(Role.GROWER, 'milestone-patch-b');
      const tokenA = await loginAndGetToken(growerA.email);
      const cropA = await createCrop(growerA.id, 'Squash');
      const cycleA = await createCycle(growerA.id, cropA.id, 'Squash Cycle');
      const milestoneA = await createMilestone(cycleA.id, 'Sown', 1, 10);

      const res = await request(app.getHttpServer())
        .patch(`/milestones/${milestoneA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ expectedDurationDays: 14 })
        .expect(200);
      expect(
        (res.body as { expectedDurationDays: number }).expectedDurationDays,
      ).toBe(14);

      const tokenB = await loginAndGetToken(growerB.email);
      await request(app.getHttpServer())
        .patch(`/milestones/${milestoneA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ expectedDurationDays: 20 })
        .expect(404);
    });

    it('deletes a milestone that no batch has reached', async () => {
      const grower = await createUser(Role.GROWER, 'milestone-delete');
      const token = await loginAndGetToken(grower.email);
      const crop = await createCrop(grower.id, 'Cucumber');
      const cycle = await createCycle(grower.id, crop.id, 'Cucumber Cycle');
      const milestone = await createMilestone(cycle.id, 'Sown', 1, 10);

      await request(app.getHttpServer())
        .delete(`/milestones/${milestone.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      createdMilestoneIds.splice(createdMilestoneIds.indexOf(milestone.id), 1);
    });
  });
});
