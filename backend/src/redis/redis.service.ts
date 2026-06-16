import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('REDIS_URL');

    // Upstash utilise rediss:// (TLS) — ioredis le détecte automatiquement.
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    this.client.on('connect', () => this.logger.log('Connexion Redis (Upstash) établie'));
    this.client.on('error', (err) => this.logger.error(`Erreur Redis : ${err.message}`));
  }

  /** Vérifie la disponibilité de Redis (utilisé par le health check). */
  async ping(): Promise<boolean> {
    const res = await this.client.ping();
    return res === 'PONG';
  }

  /** Définit une clé avec un TTL optionnel (en secondes). */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /** Incrémente un compteur et garantit un TTL (utile pour le rate-limiting). */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
