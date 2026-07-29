import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../generated/prisma/enums';

describe('BatchModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdCropIds: string[] = [];
  const createdVarietyIds: string[] = [];
  const createdCycleIds: string[] = [];
  const createdMilestoneIds: string[] = [];
  const createdBatchIds: string[] = [];
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

  async function createFullSetup(label: string) {
    const grower = await createUser(Role.GROWER, label);
    const token = await loginAndGetToken(grower.email);
    const crop = await createCrop(grower.id, `Crop ${label}`);
    const variety = await createVariety(crop.id, `Variety ${label}`);
    const cycle = await createCycle(grower.id, crop.id, `Cycle ${label}`);
    await createMilestone(cycle.id, 'Sown', 1, 10);
    await createMilestone(cycle.id, 'Harvested', 2, 20);
    return { grower, token, crop, variety, cycle };
  }

  async function createBatchViaApi(
    token: string,
    crop: { id: string },
    variety: { id: string },
    cycle: { id: string },
  ) {
    const res = await request(app.getHttpServer())
      .post('/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cropId: crop.id,
        varietyId: variety.id,
        cycleId: cycle.id,
        quantity: 100,
        predictedYield: 80,
      })
      .expect(201);
    const body = res.body as { id: string };
    createdBatchIds.push(body.id);
    return body;
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

  describe('POST /batches', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/batches')
        .send({
          cropId: 'irrelevant',
          varietyId: 'irrelevant',
          cycleId: 'irrelevant',
          quantity: 10,
          predictedYield: 8,
        })
        .expect(401);
    });

    it('returns 403 for a non-Grower', async () => {
      const vendor = await createUser(Role.VENDOR, 'create-nongrower');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cropId: 'irrelevant',
          varietyId: 'irrelevant',
          cycleId: 'irrelevant',
          quantity: 10,
          predictedYield: 8,
        })
        .expect(403);
    });

    it('returns 404 when the cropId does not belong to the requesting Grower', async () => {
      const growerA = await createUser(Role.GROWER, 'create-a');
      const growerB = await createUser(Role.GROWER, 'create-b');
      const cropB = await createCrop(growerB.id, 'Tomato B');
      const varietyB = await createVariety(cropB.id, 'Roma B');
      const cycleB = await createCycle(growerB.id, cropB.id, 'Cycle B');
      const token = await loginAndGetToken(growerA.email);

      await request(app.getHttpServer())
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cropId: cropB.id,
          varietyId: varietyB.id,
          cycleId: cycleB.id,
          quantity: 10,
          predictedYield: 8,
        })
        .expect(404);
    });

    it('returns 404 when the variety does not belong to the crop', async () => {
      const { token, crop, cycle } = await createFullSetup('create-badvariety');
      const otherCrop = await createCrop(
        (await prisma.crop.findUniqueOrThrow({ where: { id: crop.id } }))
          .ownerId,
        'Other Crop',
      );
      const otherVariety = await createVariety(otherCrop.id, 'Other Variety');

      await request(app.getHttpServer())
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cropId: crop.id,
          varietyId: otherVariety.id,
          cycleId: cycle.id,
          quantity: 10,
          predictedYield: 8,
        })
        .expect(404);
    });

    it('returns 404 when the cycle does not belong to the crop', async () => {
      const { token, crop, variety } = await createFullSetup('create-badcycle');
      const otherCrop = await createCrop(
        (await prisma.crop.findUniqueOrThrow({ where: { id: crop.id } }))
          .ownerId,
        'Second Crop',
      );
      const otherCycle = await createCycle(
        (await prisma.crop.findUniqueOrThrow({ where: { id: crop.id } }))
          .ownerId,
        otherCrop.id,
        'Second Cycle',
      );

      await request(app.getHttpServer())
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cropId: crop.id,
          varietyId: variety.id,
          cycleId: otherCycle.id,
          quantity: 10,
          predictedYield: 8,
        })
        .expect(404);
    });

    it('creates a batch and snapshots the cycle milestones as progress rows', async () => {
      const { token, crop, variety, cycle } =
        await createFullSetup('create-happy');

      const res = await request(app.getHttpServer())
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cropId: crop.id,
          varietyId: variety.id,
          cycleId: cycle.id,
          quantity: 100,
          predictedYield: 80,
        })
        .expect(201);

      const body = res.body as { id: string; currentMilestoneOrder: number };
      createdBatchIds.push(body.id);
      expect(body.currentMilestoneOrder).toBe(0);

      const progress = await prisma.batchMilestoneProgress.findMany({
        where: { batchId: body.id },
        orderBy: { order: 'asc' },
      });
      expect(progress).toHaveLength(2);
      expect(progress.map((p) => p.order)).toEqual([1, 2]);
      expect(progress.every((p) => p.reachedAt === null)).toBe(true);
    });
  });

  describe('GET /batches and GET /batches/:id', () => {
    it("only lists the requesting Grower's own batches", async () => {
      const setupA = await createFullSetup('list-a');
      const setupB = await createFullSetup('list-b');
      const batchA = await createBatchViaApi(
        setupA.token,
        setupA.crop,
        setupA.variety,
        setupA.cycle,
      );
      await createBatchViaApi(
        setupB.token,
        setupB.crop,
        setupB.variety,
        setupB.cycle,
      );

      const res = await request(app.getHttpServer())
        .get('/batches')
        .set('Authorization', `Bearer ${setupA.token}`)
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((b) => b.id);
      expect(ids).toEqual([batchA.id]);
    });

    it('returns the batch detail with ordered milestone progress, and 404 for another Grower', async () => {
      const setupA = await createFullSetup('getone-a');
      const setupB = await createFullSetup('getone-b');
      const batch = await createBatchViaApi(
        setupA.token,
        setupA.crop,
        setupA.variety,
        setupA.cycle,
      );

      const res = await request(app.getHttpServer())
        .get(`/batches/${batch.id}`)
        .set('Authorization', `Bearer ${setupA.token}`)
        .expect(200);
      const body = res.body as {
        milestoneProgress: Array<{
          order: number;
          milestone: { name: string };
        }>;
      };
      expect(body.milestoneProgress.map((p) => p.milestone.name)).toEqual([
        'Sown',
        'Harvested',
      ]);

      await request(app.getHttpServer())
        .get(`/batches/${batch.id}`)
        .set('Authorization', `Bearer ${setupB.token}`)
        .expect(404);
    });
  });

  describe('PATCH /batches/:id/milestone', () => {
    it('advances the batch to its next milestone', async () => {
      const setup = await createFullSetup('advance-happy');
      const batch = await createBatchViaApi(
        setup.token,
        setup.crop,
        setup.variety,
        setup.cycle,
      );

      const res = await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ reachedAt: '2026-02-01' })
        .expect(200);

      expect(
        (res.body as { currentMilestoneOrder: number }).currentMilestoneOrder,
      ).toBe(1);

      const progress = await prisma.batchMilestoneProgress.findFirst({
        where: { batchId: batch.id, order: 1 },
      });
      expect(progress?.reachedAt).not.toBeNull();
    });

    it('returns 409 once there are no further milestones to advance to', async () => {
      const setup = await createFullSetup('advance-final');
      const batch = await createBatchViaApi(
        setup.token,
        setup.crop,
        setup.variety,
        setup.cycle,
      );

      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ reachedAt: '2026-02-01' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ reachedAt: '2026-02-10' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ reachedAt: '2026-02-20' })
        .expect(409);
    });

    it('returns 404 for a batch not owned by the requesting Grower', async () => {
      const setupA = await createFullSetup('advance-notowned-a');
      const setupB = await createFullSetup('advance-notowned-b');
      const batch = await createBatchViaApi(
        setupB.token,
        setupB.crop,
        setupB.variety,
        setupB.cycle,
      );

      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setupA.token}`)
        .send({ reachedAt: '2026-02-01' })
        .expect(404);
    });
  });

  describe('PATCH /batches/:id/confirm-harvest', () => {
    it('returns 409 when the batch has not reached its final milestone yet', async () => {
      const setup = await createFullSetup('confirm-tooearly');
      const batch = await createBatchViaApi(
        setup.token,
        setup.crop,
        setup.variety,
        setup.cycle,
      );

      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/confirm-harvest`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ actualYield: 75 })
        .expect(409);
    });

    it('confirms the harvest once the final milestone is reached, and rejects a second confirmation', async () => {
      const setup = await createFullSetup('confirm-happy');
      const batch = await createBatchViaApi(
        setup.token,
        setup.crop,
        setup.variety,
        setup.cycle,
      );

      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ reachedAt: '2026-02-01' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/milestone`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ reachedAt: '2026-02-10' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/confirm-harvest`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ actualYield: 75 })
        .expect(200);
      expect(res.body as { harvestConfirmed: boolean }).toMatchObject({
        harvestConfirmed: true,
      });

      await request(app.getHttpServer())
        .patch(`/batches/${batch.id}/confirm-harvest`)
        .set('Authorization', `Bearer ${setup.token}`)
        .send({ actualYield: 78 })
        .expect(409);
    });
  });

  describe('GET /batches/:id/timeline', () => {
    it('is publicly readable without a token', async () => {
      const setup = await createFullSetup('timeline-public');
      const batch = await createBatchViaApi(
        setup.token,
        setup.crop,
        setup.variety,
        setup.cycle,
      );

      const res = await request(app.getHttpServer())
        .get(`/batches/${batch.id}/timeline`)
        .expect(200);
      const body = res.body as {
        milestoneProgress: Array<{ milestone: { name: string } }>;
      };
      expect(body.milestoneProgress.map((p) => p.milestone.name)).toEqual([
        'Sown',
        'Harvested',
      ]);
    });

    it('returns 404 for an unknown batch id', async () => {
      await request(app.getHttpServer())
        .get('/batches/00000000-0000-0000-0000-000000000000/timeline')
        .expect(404);
    });
  });
});
