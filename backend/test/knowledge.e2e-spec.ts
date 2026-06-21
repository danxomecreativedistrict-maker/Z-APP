// E2E des endpoints /knowledge (guard JWT, CRUD, import CSV, recherche). Infra + embeddings mockés.

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
import { FakeEmbedding, FakeMail, FakePrisma, FakeRedis } from './fakes';

describe('Knowledge (e2e)', () => {
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
        email: 'kb@example.com',
        password: 'password123',
        firstName: 'Kee',
        lastName: 'Base',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    token = reg.body.data.accessToken as string;
    await request(app.getHttpServer())
      .post('/api/company')
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'PME KB' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('refuse /knowledge sans token (401)', async () => {
    await request(app.getHttpServer()).get('/api/knowledge').expect(401);
  });

  let createdId = '';

  it('crée un élément FAQ', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/knowledge')
      .set(auth())
      .send({ type: 'FAQ', title: 'Livraison', content: 'Livraison gratuite à Cotonou' })
      .expect(201);
    expect(res.body.data.type).toBe('FAQ');
    createdId = res.body.data.id;
  });

  it('liste et filtre par type', async () => {
    const all = await request(app.getHttpServer()).get('/api/knowledge').set(auth()).expect(200);
    expect(all.body.data.length).toBeGreaterThan(0);
    const faqs = await request(app.getHttpServer())
      .get('/api/knowledge?type=FAQ')
      .set(auth())
      .expect(200);
    expect(faqs.body.data.every((k: { type: string }) => k.type === 'FAQ')).toBe(true);
  });

  it('importe des produits (CSV → JSON)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/knowledge/import-csv')
      .set(auth())
      .send({ products: [{ name: 'Sac', price: 5000, unit: 'FCFA' }, { name: 'Montre' }] })
      .expect(201);
    expect(res.body.data.imported).toBe(2);
  });

  it('recherche sémantique', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/knowledge/search')
      .set(auth())
      .send({ query: 'livraison', k: 5 })
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('met à jour puis supprime un élément', async () => {
    await request(app.getHttpServer())
      .patch(`/api/knowledge/${createdId}`)
      .set(auth())
      .send({ title: 'Livraison express' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/knowledge/${createdId}`)
      .set(auth())
      .expect(200);
  });
});
