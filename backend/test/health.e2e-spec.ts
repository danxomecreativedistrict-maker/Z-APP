// Smoke test du health check : vérifie le câblage (controller + interceptor + format
// de réponse) sans dépendre d'une vraie base Neon/Upstash (Prisma et Redis sont mockés).

// Doit être défini AVANT le chargement d'AppModule (validation d'env au démarrage).
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://u:p@localhost:5432/zapp';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        ping: jest.fn().mockResolvedValue(true),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn().mockResolvedValue(true),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health renvoie le format { success, data, message } avec services OK', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.postgres).toBe('ok');
    expect(res.body.data.redis).toBe('ok');
  });
});
