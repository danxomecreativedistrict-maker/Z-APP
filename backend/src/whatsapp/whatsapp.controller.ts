import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../auth/auth.types';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get('qr')
  async qr(@CurrentUser() user: PublicUser) {
    const companyId = await this.service.resolveCompanyId(user.id);
    const data = await this.service.getQr(companyId);
    return new Responded(
      data,
      data.status === 'CONNECTED'
        ? 'WhatsApp déjà connecté.'
        : data.qr
          ? 'QR code généré, scannez-le avec WhatsApp.'
          : 'Connexion en cours…',
    );
  }

  @Get('status')
  async status(@CurrentUser() user: PublicUser) {
    const companyId = await this.service.resolveCompanyId(user.id);
    return new Responded(await this.service.getStatus(companyId), 'Statut WhatsApp récupéré.');
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: PublicUser) {
    const companyId = await this.service.resolveCompanyId(user.id);
    return new Responded(await this.service.logout(companyId), 'WhatsApp déconnecté.');
  }
}
