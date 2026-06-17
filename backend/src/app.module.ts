import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { NovaModule } from './nova/nova.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    RealtimeModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CompanyModule,
    WhatsappModule,
    KnowledgeModule,
    NovaModule,
    NotificationsModule,
    DashboardModule,
  ],
})
export class AppModule {}
