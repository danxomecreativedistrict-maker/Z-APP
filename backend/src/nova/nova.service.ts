import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Conversation,
  ConvStatus,
  Message,
  NotifType,
  Prospect,
  ProspectScore,
  ProspectStatus,
  Sender,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { OrderService } from '../orders/order.service';
import { AnthropicService } from './anthropic.service';
import { buildNovaSystemPrompt } from './nova.prompt';
import { NovaIntent, NovaReply, NovaTurn } from './nova.types';

const HISTORY_LIMIT = 20;
const RAG_TOP_K = 5;

export interface NovaResult {
  reply: string;
  intent: NovaIntent;
  conversationId: string;
}

@Injectable()
export class NovaService {
  private readonly logger = new Logger(NovaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly anthropic: AnthropicService,
    private readonly orders: OrderService,
  ) {}

  /**
   * Pipeline NOVA : historique → RAG → prompt dynamique → Claude → persistance + scoring.
   * Retourne le texte à envoyer au prospect (l'envoi WhatsApp est géré par l'appelant).
   */
  async handleIncomingMessage(
    companyId: string,
    prospectPhone: string,
    text: string,
  ): Promise<NovaResult> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Entreprise introuvable.');
    }

    const prospect = await this.upsertProspect(companyId, prospectPhone);
    const conversation = await this.getOrCreateConversation(companyId, prospect.id, prospectPhone);

    // 1. Message entrant
    await this.prisma.message.create({
      data: { conversationId: conversation.id, sender: Sender.PROSPECT, content: text },
    });

    // 2. Historique (20 derniers)
    const history = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { sentAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    // 3. RAG (top 5)
    const hits = await this.knowledge.searchByCompany(companyId, text, RAG_TOP_K);
    const ragContext = hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.content}`).join('\n\n');

    // 4. Prompt système + tours de conversation
    const system = buildNovaSystemPrompt(company, ragContext);
    const turns = this.toTurns(history);

    // 5. Génération Claude (JSON strict)
    const reply: NovaReply = await this.anthropic.generateNovaReply(system, turns);

    // 6. Commande confirmée → création de l'Order (Module 7) + complément de message
    let finalMessage = reply.message;
    if (reply.intent === 'ORDER_CONFIRMED') {
      const order = await this.orders.createFromNova(companyId, prospect, reply.orderData);
      if (order) {
        finalMessage = `${reply.message}\n\n✅ Votre commande ${order.ref} est confirmée. Merci pour votre confiance !`;
      }
    }

    // 7. Réponse NOVA persistée
    await this.prisma.message.create({
      data: { conversationId: conversation.id, sender: Sender.NOVA, content: finalMessage },
    });

    // 8. Scoring + statut selon l'intention
    await this.applyIntent(conversation.id, prospect, reply);

    this.logger.log(
      `NOVA → ${prospectPhone} (intent=${reply.intent}, notifyManager=${reply.notifyManager})`,
    );
    return { reply: finalMessage, intent: reply.intent, conversationId: conversation.id };
  }

  /** Appel WhatsApp manqué : envoie un message d'accueil automatique + notifie le gérant. */
  async handleMissedCall(companyId: string, prospectPhone: string): Promise<NovaResult> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('Entreprise introuvable.');
    }
    const prospect = await this.upsertProspect(companyId, prospectPhone);
    const conversation = await this.getOrCreateConversation(companyId, prospect.id, prospectPhone);

    const reply = `Bonjour ! Je suis ${company.novaName}, l'assistant de ${company.name}. Je n'ai pas pu prendre votre appel. Comment puis-je vous aider ?`;

    await this.prisma.message.create({
      data: { conversationId: conversation.id, sender: Sender.NOVA, content: reply },
    });
    await this.prisma.prospect.update({
      where: { id: prospect.id },
      data: { status: ProspectStatus.CONTACTED, lastContact: new Date() },
    });
    await this.prisma.notification.create({
      data: {
        companyId,
        type: NotifType.MISSED_CALL,
        recipient: company.alertPhone || company.managerPhone || '',
        content: `Appel manqué du prospect ${prospectPhone}.`,
      },
    });

    this.logger.log(`Appel manqué de ${prospectPhone} → réponse automatique de NOVA envoyée.`);
    return { reply, intent: 'FOLLOW_UP', conversationId: conversation.id };
  }

  private toTurns(history: Message[]): NovaTurn[] {
    const turns: NovaTurn[] = history.map((m) => ({
      role: m.sender === Sender.PROSPECT ? 'user' : 'assistant',
      content: m.content,
    }));
    // L'API Claude exige que le premier message soit de rôle 'user'.
    while (turns.length > 0 && turns[0].role !== 'user') {
      turns.shift();
    }
    return turns.length > 0 ? turns : [{ role: 'user', content: '(Début de conversation)' }];
  }

  private async upsertProspect(companyId: string, phone: string): Promise<Prospect> {
    const existing = await this.prisma.prospect.findFirst({ where: { companyId, phone } });
    if (existing) return existing;
    return this.prisma.prospect.create({ data: { companyId, phone } });
  }

  private async getOrCreateConversation(
    companyId: string,
    prospectId: string,
    prospectPhone: string,
  ): Promise<Conversation> {
    const active = await this.prisma.conversation.findFirst({
      where: { companyId, prospectPhone, status: { not: ConvStatus.CLOSED } },
      orderBy: { updatedAt: 'desc' },
    });
    if (active) return active;
    return this.prisma.conversation.create({
      data: { companyId, prospectId, prospectPhone, status: ConvStatus.ACTIVE },
    });
  }

  private async applyIntent(
    conversationId: string,
    prospect: Prospect,
    reply: NovaReply,
  ): Promise<void> {
    let score: ProspectScore = prospect.score;
    let status: ProspectStatus = prospect.status;

    if (reply.intent === 'ORDER_CONFIRMED') {
      score = ProspectScore.HOT;
      status = ProspectStatus.ORDERED;
    } else if (reply.intent === 'ORDER_INTENT') {
      score = ProspectScore.HOT;
      status = ProspectStatus.INTERESTED;
    } else if (reply.intent === 'PRICE_QUERY') {
      if (score === ProspectScore.COLD) score = ProspectScore.WARM;
      status = ProspectStatus.CONTACTED;
    } else if (reply.intent !== 'NONE') {
      status = ProspectStatus.CONTACTED;
    }

    await this.prisma.prospect.update({
      where: { id: prospect.id },
      data: { score, status, lastContact: new Date() },
    });

    if (reply.intent === 'HUMAN_REQUEST') {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: ConvStatus.WAITING_HUMAN },
      });
    }

    if (reply.notifyManager || reply.intent === 'HUMAN_REQUEST') {
      await this.createManagerNotification(prospect, reply);
    }
  }

  private async createManagerNotification(prospect: Prospect, reply: NovaReply): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: prospect.companyId } });
    const recipient = company?.alertPhone || company?.managerPhone || '';
    const content =
      reply.intent === 'HUMAN_REQUEST'
        ? `Le prospect ${prospect.phone} demande à parler à un humain.`
        : `NOVA a besoin d'une vérification (prix/disponibilité) pour le prospect ${prospect.phone}.`;
    await this.prisma.notification.create({
      data: { companyId: prospect.companyId, type: NotifType.TRANSFER, recipient, content },
    });
  }
}
