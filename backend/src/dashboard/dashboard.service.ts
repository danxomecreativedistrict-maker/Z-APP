import { Injectable, NotFoundException } from '@nestjs/common';
import { ConvStatus, OrderStatus, ProspectScore, Sender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { beninDayBounds } from '../notifications/notifications.service';

export interface DashboardStats {
  prospects: { total: number; hot: number; warm: number; cold: number; newToday: number };
  conversations: { total: number; active: number; waitingHuman: number };
  orders: { total: number; today: number; revenueToday: number; revenueTotal: number };
  products: { total: number };
  notifications: { unread: number };
}

export interface ConversationSummary {
  id: string;
  prospectPhone: string;
  prospectName: string | null;
  score: ProspectScore;
  status: ConvStatus;
  updatedAt: Date;
  messageCount: number;
  lastMessage: { content: string; sender: Sender; sentAt: Date } | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(companyId: string): Promise<DashboardStats> {
    const [prospects, conversations, orders, products, notifications] = await Promise.all([
      this.prisma.prospect.findMany({ where: { companyId } }),
      this.prisma.conversation.findMany({ where: { companyId } }),
      this.prisma.order.findMany({ where: { companyId } }),
      this.prisma.product.findMany({ where: { companyId } }),
      this.prisma.notification.findMany({ where: { companyId } }),
    ]);

    const { start, end } = beninDayBounds(new Date());
    const isToday = (d: Date): boolean => d >= start && d < end;
    const notCancelled = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
    const ordersToday = notCancelled.filter((o) => isToday(o.createdAt));

    return {
      prospects: {
        total: prospects.length,
        hot: prospects.filter((p) => p.score === ProspectScore.HOT).length,
        warm: prospects.filter((p) => p.score === ProspectScore.WARM).length,
        cold: prospects.filter((p) => p.score === ProspectScore.COLD).length,
        newToday: prospects.filter((p) => isToday(p.createdAt)).length,
      },
      conversations: {
        total: conversations.length,
        active: conversations.filter((c) => c.status === ConvStatus.ACTIVE).length,
        waitingHuman: conversations.filter((c) => c.status === ConvStatus.WAITING_HUMAN).length,
      },
      orders: {
        total: orders.length,
        today: ordersToday.length,
        revenueToday: ordersToday.reduce((sum, o) => sum + o.total, 0),
        revenueTotal: notCancelled.reduce((sum, o) => sum + o.total, 0),
      },
      products: { total: products.length },
      notifications: { unread: notifications.filter((n) => !n.read).length },
    };
  }

  async getConversations(companyId: string): Promise<ConversationSummary[]> {
    const [conversations, prospects] = await Promise.all([
      this.prisma.conversation.findMany({ where: { companyId } }),
      this.prisma.prospect.findMany({ where: { companyId } }),
    ]);
    const byPhone = new Map(prospects.map((p) => [p.phone, p]));

    const summaries = await Promise.all(
      conversations.map(async (c): Promise<ConversationSummary> => {
        const messages = await this.prisma.message.findMany({
          where: { conversationId: c.id },
        });
        const sorted = [...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
        const last = sorted.length ? sorted[sorted.length - 1] : null;
        const prospect = byPhone.get(c.prospectPhone);
        return {
          id: c.id,
          prospectPhone: c.prospectPhone,
          prospectName: prospect?.name ?? null,
          score: prospect?.score ?? ProspectScore.COLD,
          status: c.status,
          updatedAt: c.updatedAt,
          messageCount: messages.length,
          lastMessage: last
            ? { content: last.content, sender: last.sender, sentAt: last.sentAt }
            : null,
        };
      }),
    );

    return summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getConversationMessages(companyId: string, conversationId: string) {
    const conversations = await this.prisma.conversation.findMany({ where: { companyId } });
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    const messages = await this.prisma.message.findMany({ where: { conversationId } });
    return [...messages]
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .map((m) => ({ id: m.id, content: m.content, sender: m.sender, sentAt: m.sentAt }));
  }

  async getProspects(companyId: string) {
    const prospects = await this.prisma.prospect.findMany({ where: { companyId } });
    return [...prospects]
      .sort((a, b) => this.lastActivity(b) - this.lastActivity(a))
      .map((p) => ({
        id: p.id,
        phone: p.phone,
        name: p.name,
        score: p.score,
        status: p.status,
        lastContact: p.lastContact,
        createdAt: p.createdAt,
      }));
  }

  async getOrders(companyId: string) {
    const [orders, prospects] = await Promise.all([
      this.prisma.order.findMany({ where: { companyId } }),
      this.prisma.prospect.findMany({ where: { companyId } }),
    ]);
    const byId = new Map(prospects.map((p) => [p.id, p]));
    return [...orders]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((o) => ({
        id: o.id,
        ref: o.ref,
        total: o.total,
        status: o.status,
        deliveryAddress: o.deliveryAddress,
        createdAt: o.createdAt,
        prospectName: byId.get(o.prospectId)?.name ?? null,
        prospectPhone: byId.get(o.prospectId)?.phone ?? null,
      }));
  }

  private lastActivity(p: { lastContact: Date | null; createdAt: Date }): number {
    return (p.lastContact ?? p.createdAt).getTime();
  }
}
