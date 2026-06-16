// E2E des endpoints /company (isolation par userId, guard JWT), infra mockée.

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
import { UploadthingService } from '../src/uploadthing/uploadthing.service';
import { FakeMail, FakePrisma, FakeRedis, FakeUploadthing } from './fakes';

describe('Company (e2e)', () => {
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
      .overrideProvider(UploadthingService)
      .useValue(new FakeUploadthing().asService())
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

    // Crée un compte vérifié pour obtenir un access token
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({
        email: 'pme@example.com',
        password: 'password123',
        firstName: 'Paul',
        lastName: 'Koffi',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    const verify = await agent
      .post('/api/auth/verify-otp')
      .send({ email: 'pme@example.com', code: mail.lastCode })
      .expect(200);
    token = verify.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('refuse /company/me sans token (401)', async () => {
    await request(app.getHttpServer()).get('/api/company/me').expect(401);
  });

  it("404 tant qu'aucune fiche n'existe", async () => {
    await request(app.getHttpServer()).get('/api/company/me').set(auth()).expect(404);
  });

  it('crée puis récupère la fiche (pays BJ par défaut)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/company')
      .set(auth())
      .send({ name: 'Ma PME', managerPhone: '+22990111213' })
      .expect(201);
    expect(created.body.data.name).toBe('Ma PME');

    const me = await request(app.getHttpServer()).get('/api/company/me').set(auth()).expect(200);
    expect(me.body.data.country).toBe('BJ');
  });

  it('met à jour la config NOVA', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/company/me/nova')
      .set(auth())
      .send({ novaName: 'ZURI', novaTone: 'casual', welcomeMessage: 'Bienvenue !' })
      .expect(200);
    expect(res.body.data.novaName).toBe('ZURI');
    expect(res.body.data.novaTone).toBe('casual');
  });

  it('rejette un ton NOVA invalide (400)', async () => {
    await request(app.getHttpServer())
      .patch('/api/company/me/nova')
      .set(auth())
      .send({ novaTone: 'agressif' })
      .expect(400);
  });

  it('marque onboarding terminé', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/company/me/onboarding-done')
      .set(auth())
      .expect(201);
    expect(res.body.data.onboardingDone).toBe(true);
  });
});
