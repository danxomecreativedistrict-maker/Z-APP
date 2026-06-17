import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderService } from './order.service';

@Module({
  imports: [NotificationsModule],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrdersModule {}
