import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardGateway } from './dashboard.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGateway],
})
export class DashboardModule {}
