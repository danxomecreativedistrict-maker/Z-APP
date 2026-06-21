// E2E de /nova/chat : pipeline NOVA complet, Claude + infra mockés.

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
import { EmbeddingService } from '../src/knowledge/embedding.service';
import { AnthropicService } from '../src/nova/anthropic.service';
import { FakeAnthropic, FakeEmbedding, FakeMail, FakePrisma, FakeRedis } from './fakes';

describe('Nova (e2e)', () => {
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
      .overrideProvider(EmbeddingService)
      .useValue(new FakeEmbedding().asService())
      .overrideProvider(AnthropicService)
      .useValue(new FakeAnthropic().asService())
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

    const agent = request.agent(app.getHttpServer());
    const reg = await agent
      .post('/api/auth/register')
      .send({
        email: 'nova@example.com',
        password: 'password123',
        firstName: 'Nina',
        lastName: 'Ova',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    // V1 : l'inscription connecte immédiatement (pas de vérification email).
    token = reg.body.data.accessToken as string;
    await request(app.getHttpServer())
      .post('/api/company')
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'Boutique NOVA' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse /nova/chat sans token (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/nova/chat')
      .send({ prospectPhone: '22990', message: 'Bonjour' })
      .expect(401);
  });

  it('génère une réponse NOVA', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/nova/chat')
      .set({ Authorization: `Bearer ${token}` })
      .send({ prospectPhone: '22990@s.whatsapp.net', message: 'Bonjour, vous avez des sacs ?' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.reply).toBe('string');
    expect(res.body.data.reply.length).toBeGreaterThan(0);
    expect(res.body.data.intent).toBeDefined();
  });
});
