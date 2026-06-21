// E2E des endpoints /dashboard : guard JWT + contrat de réponse, infra mockée.

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
import { WhatsappService } from '../src/whatsapp/whatsapp.service';
import { FakeMail, FakePrisma, FakeRedis, FakeWhatsapp } from './fakes';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  const mail = new FakeMail();
  let token = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(new FakePrisma().asService())
      .overrideProvider(RedisService)
      .useValue(new FakeRedis().asService())
      .overrideProvider(MailService)
      .useValue(mail.asService())
      .overrideProvider(WhatsappService)
      .useValue(new FakeWhatsapp().asService())
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const agent = request.agent(app.getHttpServer());
    const reg = await agent
      .post('/api/auth/register')
      .send({
        email: 'dash@example.com',
        password: 'password123',
        firstName: 'Dash',
        lastName: 'Board',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    token = reg.body.data.accessToken as string;
    await request(app.getHttpServer())
      .post('/api/company')
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'Boutique Dash' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('refuse /dashboard/stats sans token (401)', async () => {
    await request(app.getHttpServer()).get('/api/dashboard/stats').expect(401);
  });

  it('renvoie des statistiques structurées', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/stats')
      .set(auth())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.prospects.total).toBe(0);
    expect(res.body.data.conversations.active).toBe(0);
    expect(res.body.data.orders.revenueTotal).toBe(0);
    expect(res.body.data.products.total).toBe(0);
  });

  it('renvoie des listes vides (conversations, prospects, commandes)', async () => {
    for (const path of ['conversations', 'prospects', 'orders']) {
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/${path}`)
        .set(auth())
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(0);
    }
  });
});
