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
import { RealtimeService, RealtimeEventName } from '../realtime/realtime.service';

const EVENTS: RealtimeEventName[] = ['message', 'order', 'notification', 'prospect'];

@WebSocketGateway({ namespace: '/dashboard', cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(DashboardGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(): void {
    // Relaie chaque événement métier vers la room de l'entreprise concernée.
    for (const event of EVENTS) {
      this.realtime.on(event, (companyId, payload) => {
        this.server.to(companyId).emit(`dashboard:${event}`, payload);
      });
    }
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
      this.logger.debug(`Client dashboard abonné à l'entreprise ${company.id}`);
    } catch {
      client.disconnect();
    }
  }
}
