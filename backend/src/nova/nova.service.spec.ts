import { FakeAnthropic, FakePrisma } from '../../test/fakes';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { NovaService } from './nova.service';

describe('NovaService', () => {
  let service: NovaService;
  let prisma: FakePrisma;
  let anthropic: FakeAnthropic;
  let companyId: string;

  const fakeKnowledge = {
    searchByCompany: async () => [],
  } as unknown as KnowledgeService;

  beforeEach(async () => {
    prisma = new FakePrisma();
    anthropic = new FakeAnthropic();
    const company = await prisma.company.create({ data: { userId: 'u1', name: 'PME Test' } });
    companyId = company.id;
    service = new NovaService(prisma.asService(), fakeKnowledge, anthropic.asService());
  });

  it('persiste le prospect, la conversation et renvoie la réponse de NOVA', async () => {
    const result = await service.handleIncomingMessage(
      companyId,
      '22990@s.whatsapp.net',
      'Bonjour',
    );
    expect(result.reply).toBe(anthropic.nextReply.message);
    expect(result.intent).toBe('INFO_QUERY');
    expect(result.conversationId).toEqual(expect.any(String));
  });

  it('ORDER_INTENT passe le prospect en HOT / INTERESTED', async () => {
    anthropic.nextReply = {
      message: 'Parfait, je note votre commande !',
      intent: 'ORDER_INTENT',
      notifyManager: false,
      orderData: '1x Sac à main',
    };
    await service.handleIncomingMessage(companyId, '22991@s.whatsapp.net', 'Je veux un sac');
    const prospect = await prisma.prospect.findFirst({
      where: { companyId, phone: '22991@s.whatsapp.net' },
    });
    expect(prospect?.score).toBe('HOT');
    expect(prospect?.status).toBe('INTERESTED');
  });

  it('HUMAN_REQUEST passe la conversation en WAITING_HUMAN', async () => {
    anthropic.nextReply = {
      message: 'Je vous mets en relation avec un conseiller.',
      intent: 'HUMAN_REQUEST',
      notifyManager: true,
      orderData: null,
    };
    await service.handleIncomingMessage(companyId, '22992@s.whatsapp.net', 'Je veux un humain');
    const conv = await prisma.conversation.findFirst({
      where: { companyId, prospectPhone: '22992@s.whatsapp.net' },
    });
    expect(conv?.status).toBe('WAITING_HUMAN');
  });

  it('réutilise la conversation active sur un message suivant', async () => {
    const r1 = await service.handleIncomingMessage(companyId, '22993@s.whatsapp.net', 'Salut');
    const r2 = await service.handleIncomingMessage(companyId, '22993@s.whatsapp.net', 'Des sacs ?');
    expect(r1.conversationId).toBe(r2.conversationId);
  });
});
