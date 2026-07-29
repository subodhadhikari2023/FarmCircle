import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AuthModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const PASSWORD = 'Test-Password-123';

  const uniqueEmail = (label: string) =>
    `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@farmcircle.test`;

  async function registerUser(
    label: string,
    role: 'VENDOR' | 'CUSTOMER' = 'CUSTOMER',
  ) {
    const email = uniqueEmail(label);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD, name: `E2E ${label}`, role })
      .expect(201);
    createdUserIds.push((res.body as { id: string }).id);
    return { email, password: PASSWORD };
  }

  function getCookieValue(res: request.Response, name: string): string {
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
    const cookie = setCookie.find((c) => c.startsWith(`${name}=`));
    if (!cookie) {
      throw new Error(`Cookie "${name}" not found in response`);
    }
    return cookie.split(';')[0];
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
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('registers a new Customer and excludes passwordHash from the response', async () => {
      const email = uniqueEmail('register-customer');

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: PASSWORD,
          name: 'Reg Customer',
          role: 'CUSTOMER',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        email,
        name: 'Reg Customer',
        role: 'CUSTOMER',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      createdUserIds.push((res.body as { id: string }).id);
    });

    it('rejects a password shorter than 8 characters with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: uniqueEmail('short-pw'),
          password: 'short',
          name: 'Short Pw',
          role: 'CUSTOMER',
        })
        .expect(400);
    });

    it('rejects a non-registerable role with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: uniqueEmail('bad-role'),
          password: PASSWORD,
          name: 'Bad Role',
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('returns 409 when the email is already registered', async () => {
      const email = uniqueEmail('dup');
      const payload = {
        email,
        password: PASSWORD,
        name: 'Dup User',
        role: 'VENDOR',
      };

      const first = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);
      createdUserIds.push((first.body as { id: string }).id);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials and sets a refresh cookie', async () => {
      const { email, password } = await registerUser('login-ok');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(() => getCookieValue(res, 'refreshToken')).not.toThrow();
    });

    it('returns 401 for a wrong password', async () => {
      const { email } = await registerUser('login-wrong-pw');

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Wrong-Password-1' })
        .expect(401);
    });

    it('returns 401 for an unknown email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('unknown'), password: PASSWORD })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token and rotates the refresh token', async () => {
      const { email, password } = await registerUser('refresh-ok');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      const refreshCookie = getCookieValue(loginRes, 'refreshToken');

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
      // The refresh token (not necessarily the access token, which is a
      // deterministic function of sub/role/iat/exp and can collide within
      // the same second) is what proves rotation actually happened.
      expect(getCookieValue(refreshRes, 'refreshToken')).not.toBe(
        refreshCookie,
      );
    });

    it('returns 401 without a refresh cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('returns 401 when the same refresh token is reused after rotation', async () => {
      const { email, password } = await registerUser('refresh-reuse');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      const refreshCookie = getCookieValue(loginRes, 'refreshToken');

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 401 without an access token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('revokes the refresh token so a subsequent refresh is rejected', async () => {
      const { email, password } = await registerUser('logout-ok');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      const accessToken = (loginRes.body as { accessToken: string })
        .accessToken;
      const refreshCookie = getCookieValue(loginRes, 'refreshToken');

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie)
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);
    });
  });
});
