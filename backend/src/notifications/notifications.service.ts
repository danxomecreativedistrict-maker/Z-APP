import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification, NotifType, OrderStatus, ProspectScore } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MailService } from '../mail/mail.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface NotifyInput {
  companyId: string;
  type: NotifType;
  content: string;
  recipient?: string;
}

export interface DailyStats {
  date: string;
  newProspects: number;
  messages: number;
  orders: number;
  revenue: number;
  hotProspects: number;
}

// Fuseau du Bénin : UTC+1 fixe, sans heure d'été (Africa/Lagos partage ce décalage).
const BENIN_TZ = 'Africa/Lagos';

/** Convertit un numéro de téléphone en JID WhatsApp (`<digits>@s.whatsapp.net`). */
export function toWhatsappJid(phone: string): string | null {
  if (!phone) return null;
  if (phone.includes('@')) return phone;
  const digits = phone.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
}

/** Heure courante (HH:mm) au fuseau du Bénin. */
export function beninHHmm(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BENIN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/** Bornes [début, fin) de la journée courante au fuseau du Bénin (instants UTC). */
export function beninDayBounds(now: Date): { start: Date; end: Date } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: BENIN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = new Date(`${ymd}T00:00:00+01:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Compose le message de résumé quotidien envoyé au gérant. */
export function buildDailySummary(
  companyName: string,
  novaName: string,
  stats: DailyStats,
): string {
  return [
    `📊 Résumé du jour — ${companyName} (${stats.date})`,
    '',
    `🆕 Nouveaux prospects : ${stats.newProspects}`,
    `💬 Messages échangés : ${stats.messages}`,
    `🛒 Commandes : ${stats.orders}`,
    `💰 Chiffre d'affaires : ${stats.revenue.toLocaleString('fr-FR')} FCFA`,
    `🔥 Prospects chauds à relancer : ${stats.hotProspects}`,
    '',
    `— ${novaName}`,
  ].join('\n');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    @Optional() private readonly mail?: MailService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * Crée une notification et l'ENVOIE réellement au gérant via WhatsApp
   * (destinataire = alertPhone, sinon managerPhone). Marque `sent=true` si l'envoi réussit.
   */
  async notify(input: NotifyInput): Promise<Notification> {
    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      include: { user: true },
    });
    const recipient = input.recipient || company?.alertPhone || company?.managerPhone || '';
    const notif = await this.prisma.notification.create({
      data: {
        companyId: input.companyId,
        type: input.type,
        recipient,
        content: input.content,
      },
    });

    let delivered = false;

    // 1) WhatsApp (canal principal) — seulement si une session est active.
    const jid = toWhatsappJid(recipient);
    if (jid) {
      try {
        if (await this.whatsapp.sendText(input.companyId, jid, input.content)) {
          delivered = true;
          this.logger.log(
            `Notification ${input.type} envoyée au gérant par WhatsApp (${recipient}).`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Échec WhatsApp notification ${input.type} : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 2) Repli e-mail vers le gérant (fiable même si WhatsApp est hors-ligne).
    const email = company?.user?.email;
    if (this.mail && email) {
      if (await this.mail.sendNotificationEmail(email, input.type, input.content)) {
        delivered = true;
        this.logger.log(`Notification ${input.type} envoyée au gérant par e-mail (${email}).`);
      }
    }

    if (!delivered) {
      this.logger.warn(
        `Notification ${input.type} non distribuée (ni WhatsApp ni e-mail) pour l'entreprise ${input.companyId}.`,
      );
    }

    const result = delivered
      ? await this.prisma.notification.update({ where: { id: notif.id }, data: { sent: true } })
      : notif;
    this.realtime?.emit('notification', input.companyId, result);
    return result;
  }

  async list(userId: string): Promise<Notification[]> {
    const companyId = await this.resolveCompanyId(userId);
    return this.prisma.notification.findMany({
      where: { companyId },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const companyId = await this.resolveCompanyId(userId);
    const notif = await this.prisma.notification.findFirst({ where: { id, companyId } });
    if (!notif) throw new NotFoundException('Notification introuvable.');
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  /** Déclenchement manuel du résumé quotidien (aperçu/test par le gérant). */
  async testDailySummary(userId: string): Promise<Notification | null> {
    const companyId = await this.resolveCompanyId(userId);
    return this.sendDailySummaryFor(companyId);
  }

  /** Calcule puis envoie le résumé quotidien d'une entreprise. */
  async sendDailySummaryFor(companyId: string): Promise<Notification | null> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return null;
    const stats = await this.collectDailyStats(companyId);
    const content = buildDailySummary(company.name, company.novaName, stats);
    return this.notify({ companyId, type: NotifType.DAILY_SUMMARY, content });
  }

  /** Toutes les minutes : envoie le résumé aux entreprises dont l'heure configurée correspond. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendScheduledSummaries(): Promise<void> {
    const hhmm = beninHHmm(new Date());
    try {
      const companies = await this.prisma.company.findMany({ where: { dailySummaryOn: true } });
      for (const company of companies) {
        if (company.dailySummaryTime !== hhmm) continue;
        try {
          await this.sendDailySummaryFor(company.id);
        } catch (err) {
          this.logger.error(
            `Résumé quotidien échoué (${company.id}) : ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Planification du résumé quotidien : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async collectDailyStats(companyId: string): Promise<DailyStats> {
    const now = new Date();
    const { start, end } = beninDayBounds(now);
    const [newProspects, messages, orders, hotProspects] = await Promise.all([
      this.prisma.prospect.count({ where: { companyId, createdAt: { gte: start, lt: end } } }),
      this.prisma.message.count({
        where: { conversation: { companyId }, sentAt: { gte: start, lt: end } },
      }),
      this.prisma.order.findMany({
        where: {
          companyId,
          createdAt: { gte: start, lt: end },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      this.prisma.prospect.count({ where: { companyId, score: ProspectScore.HOT } }),
    ]);
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    return {
      date: new Intl.DateTimeFormat('fr-FR', {
        timeZone: BENIN_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(now),
      newProspects,
      messages,
      orders: orders.length,
      revenue,
      hotProspects,
    };
  }

  private async resolveCompanyId(userId: string): Promise<string> {
    const company = await this.prisma.company.findFirst({ where: { userId } });
    if (!company) throw new NotFoundException("Aucune fiche entreprise. Créez-la d'abord.");
    return company.id;
  }
}
