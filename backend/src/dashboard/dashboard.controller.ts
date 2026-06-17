import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  async stats(@CurrentUser() user: PublicUser) {
    const companyId = await this.companyId(user.id);
    return new Responded(
      await this.dashboard.getStats(companyId),
      'Statistiques du tableau de bord.',
    );
  }

  @Get('conversations')
  async conversations(@CurrentUser() user: PublicUser) {
    const companyId = await this.companyId(user.id);
    return new Responded(await this.dashboard.getConversations(companyId), 'Conversations.');
  }

  @Get('conversations/:id/messages')
  async messages(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    const companyId = await this.companyId(user.id);
    return new Responded(
      await this.dashboard.getConversationMessages(companyId, id),
      'Messages de la conversation.',
    );
  }

  @Get('prospects')
  async prospects(@CurrentUser() user: PublicUser) {
    const companyId = await this.companyId(user.id);
    return new Responded(await this.dashboard.getProspects(companyId), 'Prospects.');
  }

  @Get('orders')
  async orders(@CurrentUser() user: PublicUser) {
    const companyId = await this.companyId(user.id);
    return new Responded(await this.dashboard.getOrders(companyId), 'Commandes.');
  }

  private async companyId(userId: string): Promise<string> {
    const company = await this.prisma.company.findFirst({ where: { userId } });
    if (!company) {
      throw new NotFoundException("Aucune fiche entreprise. Créez-la d'abord.");
    }
    return company.id;
  }
}
