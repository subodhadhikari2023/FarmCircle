import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from './../generated/prisma/enums';

describe('UsersModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdAddressIds: string[] = [];
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
    if (createdAddressIds.length > 0) {
      await prisma.address.deleteMany({
        where: { id: { in: createdAddressIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  describe('GET /users/me', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it("returns the authenticated user's own safe profile", async () => {
      const customer = await createUser(Role.CUSTOMER, 'me-customer');
      const token = await loginAndGetToken(customer.email);

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: customer.id,
        email: customer.email,
        role: 'CUSTOMER',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('googleId');
    });
  });

  describe('PATCH /users/me', () => {
    it('updates own name', async () => {
      const vendor = await createUser(Role.VENDOR, 'patchme-vendor');
      const token = await loginAndGetToken(vendor.email);

      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect((res.body as { name: string }).name).toBe('Updated Name');
    });

    it('rejects fields outside the whitelist with 400', async () => {
      const vendor = await createUser(Role.VENDOR, 'patchme-reject');
      const token = await loginAndGetToken(vendor.email);

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('POST /users/me/addresses', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/users/me/addresses')
        .send({ addressText: '123 Farm Lane', latitude: 12.9, longitude: 77.6 })
        .expect(401);
    });

    it('creates an address owned by the authenticated user', async () => {
      const customer = await createUser(Role.CUSTOMER, 'addr-create');
      const token = await loginAndGetToken(customer.email);

      const res = await request(app.getHttpServer())
        .post('/users/me/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          addressText: '123 Farm Lane',
          landmark: 'Near the water tower',
          latitude: 12.9,
          longitude: 77.6,
        })
        .expect(201);

      const body = res.body as { id: string; userId: string };
      createdAddressIds.push(body.id);
      expect(body.userId).toBe(customer.id);
    });

    it('returns 400 for an out-of-range latitude', async () => {
      const customer = await createUser(Role.CUSTOMER, 'addr-invalid');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .post('/users/me/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ addressText: '123 Farm Lane', latitude: 200, longitude: 77.6 })
        .expect(400);
    });
  });

  describe('GET /users/me/addresses', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get('/users/me/addresses')
        .expect(401);
    });

    it("lists only the authenticated user's own addresses", async () => {
      const customer = await createUser(Role.CUSTOMER, 'addr-list');
      const otherCustomer = await createUser(Role.CUSTOMER, 'addr-list-other');
      const token = await loginAndGetToken(customer.email);
      const otherToken = await loginAndGetToken(otherCustomer.email);

      const createRes = await request(app.getHttpServer())
        .post('/users/me/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ addressText: '123 Farm Lane', latitude: 12.9, longitude: 77.6 })
        .expect(201);
      const address = createRes.body as { id: string };
      createdAddressIds.push(address.id);

      await request(app.getHttpServer())
        .post('/users/me/addresses')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ addressText: '456 Other St', latitude: 13.1, longitude: 77.5 })
        .expect(201)
        .then((res) => {
          createdAddressIds.push((res.body as { id: string }).id);
        });

      const listRes = await request(app.getHttpServer())
        .get('/users/me/addresses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const ids = (listRes.body as Array<{ id: string }>).map((a) => a.id);
      expect(ids).toEqual([address.id]);
    });
  });

  describe('GET /users', () => {
    it('returns 403 for a non-admin', async () => {
      const customer = await createUser(Role.CUSTOMER, 'list-nonadmin');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lists only Vendor/Customer accounts for an admin', async () => {
      const admin = await createUser(Role.ADMIN, 'list-admin');
      const grower = await createUser(Role.GROWER, 'list-grower');
      const vendor = await createUser(Role.VENDOR, 'list-vendor');
      const adminToken = await loginAndGetToken(admin.email);

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = (res.body as Array<{ id: string }>).map((u) => u.id);
      expect(ids).toContain(vendor.id);
      expect(ids).not.toContain(grower.id);
      expect(ids).not.toContain(admin.id);
    });
  });

  describe('GET /users/:id', () => {
    it('returns 403 for a non-admin', async () => {
      const customer = await createUser(Role.CUSTOMER, 'getone-nonadmin');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .get(`/users/${customer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 404 for a Grower account (scoped out like the list endpoint)', async () => {
      const admin = await createUser(Role.ADMIN, 'getone-admin');
      const grower = await createUser(Role.GROWER, 'getone-grower');
      const adminToken = await loginAndGetToken(admin.email);

      await request(app.getHttpServer())
        .get(`/users/${grower.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns the account for an admin viewing a Vendor', async () => {
      const admin = await createUser(Role.ADMIN, 'getone-admin2');
      const vendor = await createUser(Role.VENDOR, 'getone-vendor');
      const adminToken = await loginAndGetToken(admin.email);

      const res = await request(app.getHttpServer())
        .get(`/users/${vendor.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((res.body as { id: string }).id).toBe(vendor.id);
    });
  });

  describe('PATCH /users/:id/suspend and /reactivate', () => {
    it('suspends then reactivates a Vendor account, 409ing on repeat calls', async () => {
      const admin = await createUser(Role.ADMIN, 'suspend-admin');
      const vendor = await createUser(Role.VENDOR, 'suspend-vendor');
      const adminToken = await loginAndGetToken(admin.email);

      const suspendRes = await request(app.getHttpServer())
        .patch(`/users/${vendor.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((suspendRes.body as { isSuspended: boolean }).isSuspended).toBe(
        true,
      );

      await request(app.getHttpServer())
        .patch(`/users/${vendor.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      const reactivateRes = await request(app.getHttpServer())
        .patch(`/users/${vendor.id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((reactivateRes.body as { isSuspended: boolean }).isSuspended).toBe(
        false,
      );

      await request(app.getHttpServer())
        .patch(`/users/${vendor.id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });

    it('returns 404 when suspending a Grower account', async () => {
      const admin = await createUser(Role.ADMIN, 'suspend-admin2');
      const grower = await createUser(Role.GROWER, 'suspend-grower');
      const adminToken = await loginAndGetToken(admin.email);

      await request(app.getHttpServer())
        .patch(`/users/${grower.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 403 for a non-admin caller', async () => {
      const customer = await createUser(Role.CUSTOMER, 'suspend-nonadmin');
      const vendor = await createUser(Role.VENDOR, 'suspend-target');
      const token = await loginAndGetToken(customer.email);

      await request(app.getHttpServer())
        .patch(`/users/${vendor.id}/suspend`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
