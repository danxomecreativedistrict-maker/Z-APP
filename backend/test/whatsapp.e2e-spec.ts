// E2E des endpoints /whatsapp : guard JWT + contrat de réponse, Baileys mocké.

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

describe('WhatsApp (e2e)', () => {
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
        email: 'wa@example.com',
        password: 'password123',
        firstName: 'Wad',
        lastName: 'Sow',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    token = reg.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('refuse /whatsapp/status sans token (401)', async () => {
    await request(app.getHttpServer()).get('/api/whatsapp/status').expect(401);
  });

  it('renvoie le statut WhatsApp', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/whatsapp/status')
      .set(auth())
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DISCONNECTED');
  });

  it('renvoie un QR code', async () => {
    const res = await request(app.getHttpServer()).get('/api/whatsapp/qr').set(auth()).expect(200);
    expect(res.body.data.qr).toContain('data:image');
  });

  it('déconnecte WhatsApp', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/whatsapp/logout')
      .set(auth())
      .expect(200);
    expect(res.body.data.status).toBe('DISCONNECTED');
  });
});
