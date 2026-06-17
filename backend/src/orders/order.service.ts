import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotifType, Order, OrderStatus, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OrderDataSchema } from './order.types';

export interface ProspectRef {
  id: string;
  phone: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * Crée une commande CONFIRMED à partir des données structurées de NOVA.
   * Retourne null si les données sont absentes ou invalides.
   */
  async createFromNova(
    companyId: string,
    prospect: ProspectRef,
    orderData: unknown,
  ): Promise<Order | null> {
    const parsed = OrderDataSchema.safeParse(orderData);
    if (!parsed.success || parsed.data.items.length === 0) {
      return null;
    }
    const data = parsed.data;

    let total = 0;
    const lines: { productId: string; quantity: number; unitPrice: number; total: number }[] = [];
    for (const item of data.items) {
      const product = await this.findOrCreateProduct(
        companyId,
        item.name,
        item.unitPrice ?? undefined,
      );
      const unitPrice = item.unitPrice ?? product.price;
      const lineTotal = unitPrice * item.quantity;
      total += lineTotal;
      lines.push({ productId: product.id, quantity: item.quantity, unitPrice, total: lineTotal });
    }

    const ref = await this.generateRef();
    const order = await this.prisma.order.create({
      data: {
        companyId,
        prospectId: prospect.id,
        ref,
        total,
        status: OrderStatus.CONFIRMED,
        deliveryAddress: data.deliveryAddress ?? null,
      },
    });
    for (const line of lines) {
      await this.prisma.orderItem.create({ data: { orderId: order.id, ...line } });
    }
    if (data.customerName) {
      await this.prisma.prospect.update({
        where: { id: prospect.id },
        data: { name: data.customerName },
      });
    }

    await this.notifications.notify({
      companyId,
      type: NotifType.SALE,
      content: `🎉 Nouvelle vente ${ref} — ${total} FCFA — prospect ${prospect.phone}${
        data.deliveryAddress ? ` — livraison : ${data.deliveryAddress}` : ''
      }.`,
    });

    this.realtime?.emit('order', companyId, order);
    this.logger.log(`Commande ${ref} créée (${total} FCFA) pour l'entreprise ${companyId}`);
    return order;
  }

  private async findOrCreateProduct(
    companyId: string,
    name: string,
    price?: number,
  ): Promise<Product> {
    const existing = await this.prisma.product.findFirst({ where: { companyId, name } });
    if (existing) return existing;
    return this.prisma.product.create({
      data: { companyId, name, description: '', price: price ?? 0 },
    });
  }

  private async generateRef(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count();
    return `CMD-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}
