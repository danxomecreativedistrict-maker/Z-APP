import { FakePrisma, FakeWhatsapp } from '../../test/fakes';
import {
  NotificationsService,
  beninHHmm,
  buildDailySummary,
  toWhatsappJid,
} from './notifications.service';

describe('NotificationsService', () => {
  let prisma: FakePrisma;
  let whatsapp: FakeWhatsapp;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = new FakePrisma();
    whatsapp = new FakeWhatsapp();
    service = new NotificationsService(prisma.asService(), whatsapp.asService());
  });

  it('crée et ENVOIE la notification au gérant (sent=true)', async () => {
    const spy = jest.spyOn(whatsapp, 'sendText');
    const company = await prisma.company.create({
      data: { userId: 'u1', name: 'PME', managerPhone: '+229 97 00 00 00' },
    });
    const notif = await service.notify({
      companyId: company.id,
      type: 'SALE',
      content: 'Nouvelle vente CMD-2026-0001.',
    });
    expect(spy).toHaveBeenCalledWith(
      company.id,
      '22997000000@s.whatsapp.net',
      'Nouvelle vente CMD-2026-0001.',
    );
    expect(notif.sent).toBe(true);
    expect(notif.recipient).toBe('+229 97 00 00 00');
  });

  it('préfère alertPhone au managerPhone comme destinataire', async () => {
    const spy = jest.spyOn(whatsapp, 'sendText');
    const company = await prisma.company.create({
      data: { userId: 'u1', name: 'PME', managerPhone: '+229111', ownerPhone: '+229000' },
    });
    await prisma.company.update({ where: { id: company.id }, data: { alertPhone: '+229999' } });
    await service.notify({ companyId: company.id, type: 'TRANSFER', content: 'Transfert.' });
    expect(spy).toHaveBeenCalledWith(company.id, '229999@s.whatsapp.net', 'Transfert.');
  });

  it('ne marque pas sent si aucun destinataire', async () => {
    const spy = jest.spyOn(whatsapp, 'sendText');
    const company = await prisma.company.create({ data: { userId: 'u1', name: 'PME' } });
    const notif = await service.notify({
      companyId: company.id,
      type: 'MISSED_CALL',
      content: 'Appel manqué.',
    });
    expect(spy).not.toHaveBeenCalled();
    expect(notif.sent).toBe(false);
  });

  it('liste les notifications de l’entreprise et marque comme lue', async () => {
    const company = await prisma.company.create({
      data: { userId: 'u9', name: 'PME', managerPhone: '+229555' },
    });
    await service.notify({ companyId: company.id, type: 'SALE', content: 'Vente A.' });
    const list = await service.list('u9');
    expect(list.length).toBe(1);
    expect(list[0].read).toBe(false);
    const updated = await service.markRead('u9', list[0].id);
    expect(updated.read).toBe(true);
  });

  it('markRead échoue (404) pour une notification inexistante', async () => {
    await prisma.company.create({ data: { userId: 'u9', name: 'PME' } });
    await expect(service.markRead('u9', 'inconnu')).rejects.toThrow();
  });

  it('envoie un résumé quotidien avec les stats du jour', async () => {
    const company = await prisma.company.create({
      data: { userId: 'u2', name: 'Boutique', managerPhone: '+229777' },
    });
    await prisma.prospect.create({ data: { companyId: company.id, phone: '22990' } });
    await prisma.order.create({
      data: {
        companyId: company.id,
        prospectId: 'p1',
        ref: 'CMD-2026-0001',
        total: 50000,
        status: 'CONFIRMED',
      },
    });
    const notif = await service.testDailySummary('u2');
    expect(notif?.type).toBe('DAILY_SUMMARY');
    expect(notif?.content).toContain('Résumé du jour');
    expect(notif?.content).toContain('Commandes : 1');
    expect(notif?.content).toContain('50');
    expect(notif?.sent).toBe(true);
  });

  describe('helpers', () => {
    it('toWhatsappJid normalise les numéros', () => {
      expect(toWhatsappJid('+229 90 00 00 00')).toBe('22990000000@s.whatsapp.net');
      expect(toWhatsappJid('22990@s.whatsapp.net')).toBe('22990@s.whatsapp.net');
      expect(toWhatsappJid('')).toBeNull();
    });

    it('beninHHmm convertit en heure du Bénin (UTC+1)', () => {
      expect(beninHHmm(new Date('2026-06-16T18:30:00Z'))).toBe('19:30');
    });

    it('buildDailySummary inclut les chiffres clés', () => {
      const text = buildDailySummary('PME', 'NOVA', {
        date: '16/06/2026',
        newProspects: 3,
        messages: 12,
        orders: 2,
        revenue: 75000,
        hotProspects: 1,
      });
      expect(text).toContain('Nouveaux prospects : 3');
      expect(text).toContain('Commandes : 2');
      expect(text).toContain('— NOVA');
    });
  });
});
