import { Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Liste les notifications de l'entreprise (les plus récentes d'abord). */
  @Get()
  async list(@CurrentUser() user: PublicUser) {
    const data = await this.notifications.list(user.id);
    return new Responded(data, 'Notifications récupérées.');
  }

  /** Marque une notification comme lue. */
  @Patch(':id/read')
  async markRead(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    const data = await this.notifications.markRead(user.id, id);
    return new Responded(data, 'Notification marquée comme lue.');
  }

  /** Envoie immédiatement un résumé quotidien (aperçu/test par le gérant). */
  @Post('daily-summary/test')
  @HttpCode(200)
  async testSummary(@CurrentUser() user: PublicUser) {
    const data = await this.notifications.testDailySummary(user.id);
    return new Responded(data, 'Résumé quotidien envoyé.');
  }
}
