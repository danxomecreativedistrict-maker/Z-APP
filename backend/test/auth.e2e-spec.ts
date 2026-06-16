// E2E du parcours d'authentification complet, sans infra réelle :
// Prisma, Redis et Mail sont remplacés par des fakes in-memory.

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://u:p@localhost:5432/zapp';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-0123456789';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { MailService } from '../src/mail/mail.service';
import { FakeMail, FakePrisma, FakeRedis } from './fakes';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const mail = new FakeMail();

  const credentials = {
    email: 'alice@example.com',
    password: 'password123',
    firstName: 'Alice',
    lastName: 'Martin',
    acceptTerms: true,
    acceptPrivacy: true,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(new FakePrisma().asService())
      .overrideProvider(RedisService)
      .useValue(new FakeRedis().asService())
      .overrideProvider(MailService)
      .useValue(mail.asService())
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → verify-otp → me → refresh → logout', async () => {
    const agent = request.agent(app.getHttpServer());

    // 1. Inscription
    const registerRes = await agent.post('/api/auth/register').send(credentials).expect(201);
    expect(registerRes.body.success).toBe(true);

    // 2. Vérification OTP (code récupéré via le fake mail)
    const code = mail.lastCode as string;
    expect(code).toMatch(/^\d{6}$/);
    const verifyRes = await agent
      .post('/api/auth/verify-otp')
      .send({ email: credentials.email, code })
      .expect(200);
    const accessToken = verifyRes.body.data.accessToken as string;
    expect(accessToken).toEqual(expect.any(String));
    expect(verifyRes.headers['set-cookie']?.[0]).toContain('refresh_token=');

    // 3. Route protégée /me
    const meRes = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.data.email).toBe(credentials.email);
    expect(meRes.body.data.verified).toBe(true);

    // 4. Rafraîchissement (cookie httpOnly porté par l'agent)
    const refreshRes = await agent.post('/api/auth/refresh').expect(200);
    expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));

    // 5. Déconnexion
    const logoutRes = await agent.post('/api/auth/logout').expect(200);
    expect(logoutRes.body.success).toBe(true);
  });

  it('refuse /me sans jeton (401)', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('refuse un payload invalide (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'pas-un-email', password: '123' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});
