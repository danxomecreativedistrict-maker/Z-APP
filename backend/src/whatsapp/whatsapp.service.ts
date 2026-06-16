import { EventEmitter } from 'events';
import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WAStatus } from '@prisma/client';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { deriveKey, useRedisAuthState } from './redis-auth-state';

type WASocket = ReturnType<typeof makeWASocket>;

interface BoomLike {
  output?: { statusCode?: number };
}

export interface WhatsappStatusPayload {
  status: WAStatus;
  qr?: string | null;
  phone?: string | null;
}

export type StatusListener = (companyId: string, payload: WhatsappStatusPayload) => void;

const QR_WAIT_MS = 20_000;
const RECONNECT_DELAY_MS = 2_500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Logger silencieux compatible pino pour Baileys.
const silentLogger = {
  level: 'silent',
  child: () => silentLogger,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
};

@Injectable()
export class WhatsappService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly sockets = new Map<string, WASocket>();
  private readonly qrCodes = new Map<string, string>();
  private readonly statuses = new Map<string, WAStatus>();
  private readonly emitter = new EventEmitter();
  private readonly encKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.encKey = deriveKey(this.config.getOrThrow<string>('WHATSAPP_ENC_SECRET'));
    this.emitter.setMaxListeners(0);
  }

  /** Le gateway Socket.IO s'abonne ici pour relayer les statuts en temps réel. */
  onStatus(listener: StatusListener): void {
    this.emitter.on('status', listener);
  }

  /** Résout l'entreprise de l'utilisateur (isolation par userId). */
  async resolveCompanyId(userId: string): Promise<string> {
    const company = await this.prisma.company.findFirst({ where: { userId } });
    if (!company) {
      throw new NotFoundException("Aucune fiche entreprise. Créez-la d'abord.");
    }
    return company.id;
  }

  /** Démarre (si besoin) la connexion et attend le QR (ou la connexion). */
  async getQr(companyId: string): Promise<WhatsappStatusPayload> {
    await this.ensureConnection(companyId);
    const deadline = Date.now() + QR_WAIT_MS;
    while (Date.now() < deadline) {
      if (this.statuses.get(companyId) === 'CONNECTED') {
        return { status: 'CONNECTED', qr: null };
      }
      const qr = this.qrCodes.get(companyId);
      if (qr) return { status: 'CONNECTING', qr };
      await sleep(400);
    }
    return {
      status: this.statuses.get(companyId) ?? 'CONNECTING',
      qr: this.qrCodes.get(companyId) ?? null,
    };
  }

  async getStatus(companyId: string): Promise<WhatsappStatusPayload> {
    const memory = this.statuses.get(companyId);
    if (memory) {
      return { status: memory, qr: this.qrCodes.get(companyId) ?? null };
    }
    const session = await this.prisma.whatsAppSession.findUnique({ where: { companyId } });
    return { status: session?.status ?? 'DISCONNECTED', phone: session?.phone ?? null };
  }

  async logout(companyId: string): Promise<WhatsappStatusPayload> {
    const sock = this.sockets.get(companyId);
    if (sock) {
      try {
        await sock.logout();
      } catch {
        // déjà déconnecté
      }
      this.sockets.delete(companyId);
    }
    await this.clearSession(companyId);
    this.qrCodes.delete(companyId);
    await this.prisma.whatsAppSession.upsert({
      where: { companyId },
      create: { companyId, status: 'DISCONNECTED' },
      update: { status: 'DISCONNECTED', phone: null, connectedAt: null },
    });
    this.emitStatus(companyId, { status: 'DISCONNECTED' });
    return { status: 'DISCONNECTED' };
  }

  // ───────────────────────── Connexion Baileys ─────────────────────────
  private async ensureConnection(companyId: string): Promise<void> {
    if (this.sockets.has(companyId) || this.statuses.get(companyId) === 'CONNECTED') {
      return;
    }
    await this.connect(companyId);
  }

  private async connect(companyId: string): Promise<void> {
    const { state, saveCreds } = await useRedisAuthState(this.redis, companyId, this.encKey);

    let version: [number, number, number] | undefined;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      version = undefined; // repli sur la version embarquée de Baileys
    }

    const sock = makeWASocket({
      version,
      auth: state,
      browser: ['Z-APP', 'Chrome', '1.0.0'],
      logger: silentLogger as unknown as never,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    this.sockets.set(companyId, sock);
    this.statuses.set(companyId, 'CONNECTING');

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const dataUrl = await toDataURL(qr);
        this.qrCodes.set(companyId, dataUrl);
        this.emitStatus(companyId, { status: 'CONNECTING', qr: dataUrl });
      }

      if (connection === 'open') {
        this.qrCodes.delete(companyId);
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0] ?? null;
        await this.markConnected(companyId, phone);
        this.emitStatus(companyId, { status: 'CONNECTED', phone });
        this.logger.log(`WhatsApp connecté pour l'entreprise ${companyId}`);
      }

      if (connection === 'close') {
        this.sockets.delete(companyId);
        const statusCode = (lastDisconnect?.error as unknown as BoomLike)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          await this.clearSession(companyId);
          await this.prisma.whatsAppSession.upsert({
            where: { companyId },
            create: { companyId, status: 'DISCONNECTED' },
            update: { status: 'DISCONNECTED', phone: null, connectedAt: null },
          });
          this.emitStatus(companyId, { status: 'DISCONNECTED' });
          await this.notifyDisconnect(companyId);
          this.logger.warn(`WhatsApp déconnecté (logout) pour l'entreprise ${companyId}`);
        } else {
          // Déconnexion transitoire → reconnexion automatique
          this.emitStatus(companyId, { status: 'CONNECTING' });
          setTimeout(() => {
            void this.connect(companyId).catch((err) =>
              this.logger.error(`Échec de reconnexion ${companyId} : ${err}`),
            );
          }, RECONNECT_DELAY_MS);
        }
      }
    });
  }

  private async markConnected(companyId: string, phone: string | null): Promise<void> {
    await this.prisma.whatsAppSession.upsert({
      where: { companyId },
      create: { companyId, status: 'CONNECTED', phone, connectedAt: new Date() },
      update: { status: 'CONNECTED', phone, connectedAt: new Date() },
    });
  }

  private async clearSession(companyId: string): Promise<void> {
    const keys = await this.redis.keys(`wa:${companyId}:*`);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  private async notifyDisconnect(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { user: true },
    });
    if (company?.user?.email) {
      await this.mail
        .sendWhatsappDisconnectedEmail(company.user.email, company.name)
        .catch((err) => this.logger.error(`Alerte email échouée : ${err}`));
    }
  }

  private emitStatus(companyId: string, payload: WhatsappStatusPayload): void {
    this.statuses.set(companyId, payload.status);
    if (payload.qr) {
      this.qrCodes.set(companyId, payload.qr);
    } else if (payload.status !== 'CONNECTING') {
      this.qrCodes.delete(companyId);
    }
    this.emitter.emit('status', companyId, payload);
  }

  onModuleDestroy(): void {
    for (const sock of this.sockets.values()) {
      try {
        sock.end(undefined);
      } catch {
        // ignore
      }
    }
  }
}
