import { NotFoundException } from '@nestjs/common';
import { KBType } from '@prisma/client';
import { FakeEmbedding, FakePrisma } from '../../test/fakes';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let prisma: FakePrisma;
  const USER = 'user-1';

  beforeEach(async () => {
    prisma = new FakePrisma();
    await prisma.company.create({ data: { userId: USER, name: 'PME' } });
    service = new KnowledgeService(prisma.asService(), new FakeEmbedding().asService());
  });

  it("create ajoute un élément (et l'embed)", async () => {
    const item = await service.create(USER, {
      type: KBType.FAQ,
      title: 'Horaires',
      content: 'Ouvert de 8h à 18h',
    });
    expect(item.title).toBe('Horaires');
    expect(item.type).toBe(KBType.FAQ);
  });

  it('create échoue sans fiche entreprise', async () => {
    await expect(
      service.create('inconnu', { type: KBType.FAQ, title: 't', content: 'c' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('list filtre par type', async () => {
    await service.create(USER, { type: KBType.FAQ, title: 'A', content: 'a' });
    await service.create(USER, { type: KBType.POLICY, title: 'B', content: 'b' });
    const faqs = await service.list(USER, KBType.FAQ);
    expect(faqs).toHaveLength(1);
    expect(faqs[0].type).toBe(KBType.FAQ);
  });

  it('importProducts crée des items PRODUCT', async () => {
    const res = await service.importProducts(USER, [
      { name: 'Sac à main', price: 5000, unit: 'FCFA' },
      { name: 'Chaussures' },
    ]);
    expect(res.imported).toBe(2);
    expect(await service.list(USER, KBType.PRODUCT)).toHaveLength(2);
  });

  it("isolation : un autre compte n'accède pas aux éléments", async () => {
    const item = await service.create(USER, { type: KBType.FAQ, title: 'X', content: 'x' });
    await prisma.company.create({ data: { userId: 'user-2', name: 'Autre' } });
    await expect(service.getOne('user-2', item.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('search renvoie des résultats', async () => {
    await service.create(USER, {
      type: KBType.FAQ,
      title: 'Livraison',
      content: 'Livraison gratuite',
    });
    const results = await service.search(USER, 'livraison', 5);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('score');
  });
});
