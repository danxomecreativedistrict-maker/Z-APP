import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';

@WebSocketGateway({ namespace: '/whatsapp', cors: { origin: '*' } })
export class WhatsappGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(WhatsappGateway.name);

  constructor(
    private readonly service: WhatsappService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(): void {
    // Relaie chaque changement de statut WhatsApp vers la room de l'entreprise.
    this.service.onStatus((companyId, payload) => {
      this.server.to(companyId).emit('whatsapp:status', payload);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth?.token ?? '') as string;
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const company = await this.prisma.company.findFirst({ where: { userId: payload.sub } });
      if (!company) {
        client.disconnect();
        return;
      }
      await client.join(company.id);
      const status = await this.service.getStatus(company.id);
      client.emit('whatsapp:status', status);
      this.logger.debug(`Client WS abonné à l'entreprise ${company.id}`);
    } catch {
      client.disconnect();
    }
  }
}
