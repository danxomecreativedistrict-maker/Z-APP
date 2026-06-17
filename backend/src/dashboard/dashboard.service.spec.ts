import { FakePrisma } from '../../test/fakes';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let prisma: FakePrisma;
  let service: DashboardService;
  let companyId: string;

  beforeEach(async () => {
    prisma = new FakePrisma();
    service = new DashboardService(prisma.asService());
    const company = await prisma.company.create({ data: { userId: 'u1', name: 'PME' } });
    companyId = company.id;
  });

  it('agrège des stats vides (tout à zéro)', async () => {
    const stats = await service.getStats(companyId);
    expect(stats.prospects.total).toBe(0);
    expect(stats.conversations.active).toBe(0);
    expect(stats.orders.total).toBe(0);
    expect(stats.orders.revenueTotal).toBe(0);
    expect(stats.products.total).toBe(0);
    expect(stats.notifications.unread).toBe(0);
  });

  it('compte prospects par score, conversations, commandes et CA', async () => {
    const p1 = await prisma.prospect.create({ data: { companyId, phone: '22990' } });
    await prisma.prospect.update({ where: { id: p1.id }, data: { score: 'HOT', name: 'Awa' } });
    await prisma.prospect.create({ data: { companyId, phone: '22991' } });

    const conv = await prisma.conversation.create({
      data: { companyId, prospectId: p1.id, prospectPhone: '22990', status: 'ACTIVE' },
    });
    await prisma.message.create({
      data: { conversationId: conv.id, sender: 'PROSPECT', content: 'Bonjour' },
    });
    await prisma.message.create({
      data: { conversationId: conv.id, sender: 'NOVA', content: 'Bonjour 👋' },
    });

    await prisma.order.create({
      data: {
        companyId,
        prospectId: p1.id,
        ref: 'CMD-2026-0001',
        total: 50000,
        status: 'CONFIRMED',
      },
    });
    await prisma.order.create({
      data: {
        companyId,
        prospectId: p1.id,
        ref: 'CMD-2026-0002',
        total: 10000,
        status: 'CANCELLED',
      },
    });
    await prisma.notification.create({
      data: { companyId, type: 'SALE', recipient: '229', content: 'Vente' },
    });

    const stats = await service.getStats(companyId);
    expect(stats.prospects.total).toBe(2);
    expect(stats.prospects.hot).toBe(1);
    expect(stats.prospects.cold).toBe(1);
    expect(stats.conversations.active).toBe(1);
    expect(stats.orders.total).toBe(2);
    expect(stats.orders.revenueTotal).toBe(50000); // la commande annulée est exclue
    expect(stats.notifications.unread).toBe(1);
  });

  it('liste les conversations avec dernier message et nom du prospect', async () => {
    const p = await prisma.prospect.create({ data: { companyId, phone: '22995' } });
    await prisma.prospect.update({ where: { id: p.id }, data: { name: 'Koffi', score: 'WARM' } });
    const conv = await prisma.conversation.create({
      data: { companyId, prospectId: p.id, prospectPhone: '22995', status: 'ACTIVE' },
    });
    await prisma.message.create({
      data: { conversationId: conv.id, sender: 'PROSPECT', content: 'Vous avez des sacs ?' },
    });

    const list = await service.getConversations(companyId);
    expect(list).toHaveLength(1);
    expect(list[0].prospectName).toBe('Koffi');
    expect(list[0].score).toBe('WARM');
    expect(list[0].messageCount).toBe(1);
    expect(list[0].lastMessage?.content).toBe('Vous avez des sacs ?');
  });

  it('renvoie les messages d’une conversation et refuse une autre entreprise (404)', async () => {
    const conv = await prisma.conversation.create({
      data: { companyId, prospectId: 'p', prospectPhone: '22996', status: 'ACTIVE' },
    });
    await prisma.message.create({
      data: { conversationId: conv.id, sender: 'PROSPECT', content: 'Salut' },
    });
    const msgs = await service.getConversationMessages(companyId, conv.id);
    expect(msgs).toHaveLength(1);
    await expect(service.getConversationMessages('autre-company', conv.id)).rejects.toThrow();
  });

  it('liste les commandes avec le nom du prospect', async () => {
    const p = await prisma.prospect.create({ data: { companyId, phone: '22997' } });
    await prisma.prospect.update({ where: { id: p.id }, data: { name: 'Awa Koffi' } });
    await prisma.order.create({
      data: {
        companyId,
        prospectId: p.id,
        ref: 'CMD-2026-0001',
        total: 25000,
        status: 'CONFIRMED',
      },
    });
    const orders = await service.getOrders(companyId);
    expect(orders).toHaveLength(1);
    expect(orders[0].ref).toBe('CMD-2026-0001');
    expect(orders[0].prospectName).toBe('Awa Koffi');
  });
});
