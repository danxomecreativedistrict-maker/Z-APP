import { Body, Controller, HttpCode, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { NovaService } from './nova.service';
import { NovaChatDto } from './dto/nova-chat.dto';

@Controller('nova')
@UseGuards(JwtAuthGuard)
export class NovaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nova: NovaService,
  ) {}

  /** Endpoint de test : simule un message de prospect et renvoie la réponse de NOVA. */
  @Post('chat')
  @HttpCode(200)
  async chat(@CurrentUser() user: PublicUser, @Body() dto: NovaChatDto) {
    const company = await this.prisma.company.findFirst({ where: { userId: user.id } });
    if (!company) {
      throw new NotFoundException("Aucune fiche entreprise. Veuillez la créer d'abord.");
    }
    const result = await this.nova.handleIncomingMessage(
      company.id,
      dto.prospectPhone,
      dto.message,
    );
    return new Responded(result, 'Réponse de NOVA générée.');
  }
}
