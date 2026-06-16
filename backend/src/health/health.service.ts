import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  postgres: 'ok' | 'down';
  redis: 'ok' | 'down';
  uptime: number;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [postgres, redis] = await Promise.all([
      this.prisma
        .ping()
        .then(() => 'ok' as const)
        .catch(() => 'down' as const),
      this.redis
        .ping()
        .then((ok) => (ok ? ('ok' as const) : ('down' as const)))
        .catch(() => 'down' as const),
    ]);

    return {
      status: postgres === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      postgres,
      redis,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
