import { FakePrisma, FakeWhatsapp } from '../../test/fakes';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let prisma: FakePrisma;
  let service: OrderService;
  let companyId: string;
  let prospect: { id: string; phone: string };

  beforeEach(async () => {
    prisma = new FakePrisma();
    const notifications = new NotificationsService(
      prisma.asService(),
      new FakeWhatsapp().asService(),
    );
    service = new OrderService(prisma.asService(), notifications);
    const company = await prisma.company.create({
      data: { userId: 'u1', name: 'PME Test', managerPhone: '22990000000' },
    });
    companyId = company.id;
    prospect = await prisma.prospect.create({
      data: { companyId, phone: '22995@s.whatsapp.net' },
    });
  });

  it('retourne null si orderData est absent ou invalide', async () => {
    expect(await service.createFromNova(companyId, prospect, null)).toBeNull();
    expect(await service.createFromNova(companyId, prospect, { items: [] })).toBeNull();
    expect(await service.createFromNova(companyId, prospect, { foo: 'bar' })).toBeNull();
  });

  it('crée une commande CONFIRMED avec une réf CMD-AAAA-NNNN et le total calculé', async () => {
    const order = await service.createFromNova(companyId, prospect, {
      customerName: 'Awa',
      deliveryAddress: 'Cotonou, Akpakpa',
      items: [
        { name: 'Sac à dos', quantity: 2, unitPrice: 25000 },
        { name: 'Trousse', quantity: 1, unitPrice: 5000 },
      ],
    });

    expect(order).not.toBeNull();
    expect(order?.ref).toMatch(/^CMD-\d{4}-0001$/);
    expect(order?.total).toBe(55000);
    expect(order?.status).toBe('CONFIRMED');
    expect(order?.deliveryAddress).toBe('Cotonou, Akpakpa');
  });

  it('renseigne le nom du prospect et crée une notification SALE', async () => {
    await service.createFromNova(companyId, prospect, {
      customerName: 'Awa',
      items: [{ name: 'Sac à dos', quantity: 1, unitPrice: 25000 }],
    });

    const updated = await prisma.prospect.findFirst({
      where: { companyId, phone: prospect.phone },
    });
    expect(updated?.name).toBe('Awa');
  });

  it('incrémente la référence de commande', async () => {
    const o1 = await service.createFromNova(companyId, prospect, {
      items: [{ name: 'A', quantity: 1, unitPrice: 1000 }],
    });
    const o2 = await service.createFromNova(companyId, prospect, {
      items: [{ name: 'B', quantity: 1, unitPrice: 2000 }],
    });
    expect(o1?.ref).toMatch(/-0001$/);
    expect(o2?.ref).toMatch(/-0002$/);
  });
});
