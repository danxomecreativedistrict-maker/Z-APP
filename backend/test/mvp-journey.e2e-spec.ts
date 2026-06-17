// E2E « parcours MVP » : valide l'intégration de tous les modules de bout en bout,
// + l'isolation multi-tenant (companyId). Infra et Claude mockés (déterministes).

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
import { WhatsappService } from '../src/whatsapp/whatsapp.service';
import {
  FakeAnthropic,
  FakeEmbedding,
  FakeMail,
  FakePrisma,
  FakeRedis,
  FakeWhatsapp,
} from './fakes';

describe('Parcours MVP (e2e)', () => {
  let app: INestApplication;
  const mail = new FakeMail();
  const anthropic = new FakeAnthropic();

  const register = async (email: string): Promise<string> => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        firstName: 'PME',
        lastName: 'Client',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    const verify = await agent
      .post('/api/auth/verify-otp')
      .send({ email, code: mail.lastCode })
      .expect(200);
    return verify.body.data.accessToken as string;
  };

  const authGet = (token: string, path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set({ Authorization: `Bearer ${token}` });
  const authPost = (token: string, path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set({ Authorization: `Bearer ${token}` })
      .send(body);

  let tokenA = '';
  let tokenB = '';

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
      .useValue(anthropic.asService())
      .overrideProvider(WhatsappService)
      .useValue(new FakeWhatsapp().asService())
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

  it('1) la PME s’inscrit et crée sa fiche entreprise', async () => {
    tokenA = await register('pme-a@example.com');
    const res = await authPost(tokenA, '/api/company', {
      name: 'Boutique Scolaire',
      sector: 'Fournitures',
      managerPhone: '+22997000000',
    }).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Boutique Scolaire');
  });

  it('2) la PME configure elle-même la base de connaissances de NOVA', async () => {
    await authPost(tokenA, '/api/knowledge', {
      type: 'PRODUCT',
      title: 'Sac à dos scolaire',
      content: 'Sac à dos scolaire robuste, prix 25000 FCFA, livraison à Cotonou sous 24h.',
    }).expect(201);

    // La base est interrogeable (RAG) par l'entreprise elle-même.
    const search = await authPost(tokenA, '/api/knowledge/search', {
      query: 'sac à dos',
    }).expect(200);
    expect(Array.isArray(search.body.data)).toBe(true);
    expect(search.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('3) NOVA répond à un prospect (RAG) puis confirme une commande', async () => {
    await authPost(tokenA, '/api/nova/chat', {
      prospectPhone: '22995@s.whatsapp.net',
      message: 'Bonjour, vous avez des sacs à dos ?',
    }).expect(200);

    anthropic.nextReply = {
      message: 'Parfait, je confirme votre commande !',
      intent: 'ORDER_CONFIRMED',
      notifyManager: true,
      orderData: {
        customerName: 'Awa Koffi',
        deliveryAddress: 'Cotonou, Akpakpa',
        items: [{ name: 'Sac à dos scolaire', quantity: 1, unitPrice: 25000 }],
      },
    };
    const res = await authPost(tokenA, '/api/nova/chat', {
      prospectPhone: '22995@s.whatsapp.net',
      message: 'Oui, je confirme.',
    }).expect(200);
    expect(res.body.data.intent).toBe('ORDER_CONFIRMED');
    expect(res.body.data.reply).toMatch(/CMD-\d{4}-\d{4}/);
  });

  it('4) le dashboard reflète prospect, commande et chiffre d’affaires', async () => {
    const stats = (await authGet(tokenA, '/api/dashboard/stats').expect(200)).body.data;
    expect(stats.prospects.total).toBe(1);
    expect(stats.conversations.total).toBeGreaterThanOrEqual(1);
    expect(stats.orders.total).toBe(1);
    expect(stats.orders.revenueTotal).toBe(25000);

    const orders = (await authGet(tokenA, '/api/dashboard/orders').expect(200)).body.data;
    expect(orders).toHaveLength(1);
    expect(orders[0].ref).toMatch(/CMD-\d{4}-\d{4}/);
    expect(orders[0].prospectName).toBe('Awa Koffi');

    const convs = (await authGet(tokenA, '/api/dashboard/conversations').expect(200)).body.data;
    expect(convs).toHaveLength(1);
    expect(convs[0].lastMessage).not.toBeNull();
  });

  it('5) une notification de vente (SALE) a été générée', async () => {
    const notifs = (await authGet(tokenA, '/api/notifications').expect(200)).body.data;
    expect(notifs.some((n: { type: string }) => n.type === 'SALE')).toBe(true);
  });

  it('6) isolation multi-tenant : une autre PME ne voit aucune donnée de la première', async () => {
    tokenB = await register('pme-b@example.com');
    await authPost(tokenB, '/api/company', { name: 'Autre PME' }).expect(201);

    const stats = (await authGet(tokenB, '/api/dashboard/stats').expect(200)).body.data;
    expect(stats.prospects.total).toBe(0);
    expect(stats.orders.total).toBe(0);
    expect(stats.conversations.total).toBe(0);

    const orders = (await authGet(tokenB, '/api/dashboard/orders').expect(200)).body.data;
    expect(orders).toHaveLength(0);

    const kb = (await authGet(tokenB, '/api/knowledge').expect(200)).body.data;
    expect(kb).toHaveLength(0);
  });

  it('7) contrat de réponse {success,data,message} respecté', async () => {
    const res = await authGet(tokenA, '/api/dashboard/stats').expect(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(typeof res.body.message).toBe('string');
  });
});
