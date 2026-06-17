// Fakes in-memory typés pour tester auth + company sans Neon/Upstash/Resend/Cloudinary réels.
import { ConfigService } from '@nestjs/config';
import {
  Company,
  Conversation,
  ConvStatus,
  KBType,
  KnowledgeItem,
  Message,
  Notification,
  NotifType,
  Order,
  OrderItem,
  OrderStatus,
  Plan,
  Product,
  Prospect,
  ProspectScore,
  ProspectStatus,
  Sender,
  User,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { MailService } from '../src/mail/mail.service';
import { UploadthingService } from '../src/uploadthing/uploadthing.service';
import { WhatsappService, WhatsappStatusPayload } from '../src/whatsapp/whatsapp.service';
import { EmbeddingService } from '../src/knowledge/embedding.service';
import { AnthropicService } from '../src/nova/anthropic.service';
import { NovaReply } from '../src/nova/nova.types';

interface UserCreateData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  termsAcceptedAt?: Date | null;
  privacyAcceptedAt?: Date | null;
  termsVersion?: string | null;
  marketingEmails?: boolean;
}

interface CompanyCreateData {
  userId: string;
  name: string;
  sector?: string | null;
  city?: string | null;
  country?: string;
  ownerPhone?: string;
  managerPhone?: string;
}

function buildCompany(data: CompanyCreateData): Company {
  return {
    id: randomUUID(),
    userId: data.userId,
    name: data.name,
    sector: data.sector ?? null,
    city: data.city ?? null,
    country: data.country ?? 'BJ',
    ownerPhone: data.ownerPhone ?? '',
    managerPhone: data.managerPhone ?? '',
    logoUrl: null,
    novaName: 'NOVA',
    novaTone: 'semi-formal',
    novaLanguage: 'fr',
    welcomeMessage: null,
    createdAt: new Date(),
    deliveryPolicy: null,
    paymentPolicy: null,
    deliveryZones: [],
    deliveryDelay: null,
    alertPhone: null,
    delivererPhone: null,
    dailySummaryTime: '20:00',
    dailySummaryOn: true,
    onboardingDone: false,
  };
}

export class FakePrisma {
  private users: User[] = [];
  private companies: Company[] = [];

  user = {
    findUnique: async (args: { where: { id?: string; email?: string } }): Promise<User | null> => {
      const { id, email } = args.where;
      return this.users.find((u) => (id !== undefined ? u.id === id : u.email === email)) ?? null;
    },
    create: async (args: { data: UserCreateData }): Promise<User> => {
      const user: User = {
        id: randomUUID(),
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        firstName: args.data.firstName,
        lastName: args.data.lastName,
        verified: false,
        plan: 'STARTER' as Plan,
        createdAt: new Date(),
        termsAcceptedAt: args.data.termsAcceptedAt ?? null,
        privacyAcceptedAt: args.data.privacyAcceptedAt ?? null,
        termsVersion: args.data.termsVersion ?? null,
        marketingEmails: args.data.marketingEmails ?? false,
      };
      this.users.push(user);
      return user;
    },
    update: async (args: {
      where: { id?: string; email?: string };
      data: Partial<User>;
    }): Promise<User> => {
      const user = this.users.find((u) =>
        args.where.id !== undefined ? u.id === args.where.id : u.email === args.where.email,
      );
      if (!user) throw new Error('Utilisateur introuvable');
      Object.assign(user, args.data);
      return user;
    },
  };

  company = {
    findFirst: async (args: {
      where: { userId?: string; id?: string };
    }): Promise<Company | null> => {
      const { userId, id } = args.where;
      return (
        this.companies.find((c) => (id !== undefined ? c.id === id : c.userId === userId)) ?? null
      );
    },
    findUnique: async (args: { where: { id: string } }): Promise<Company | null> => {
      return this.companies.find((c) => c.id === args.where.id) ?? null;
    },
    findMany: async (args?: { where?: { dailySummaryOn?: boolean } }): Promise<Company[]> => {
      const on = args?.where?.dailySummaryOn;
      return this.companies.filter((c) => (on === undefined ? true : c.dailySummaryOn === on));
    },
    create: async (args: { data: CompanyCreateData }): Promise<Company> => {
      const company = buildCompany(args.data);
      this.companies.push(company);
      return company;
    },
    update: async (args: { where: { id: string }; data: Partial<Company> }): Promise<Company> => {
      const company = this.companies.find((c) => c.id === args.where.id);
      if (!company) throw new Error('Entreprise introuvable');
      Object.assign(company, args.data);
      return company;
    },
  };

  private knowledgeItems: KnowledgeItem[] = [];

  knowledgeItem = {
    create: async (args: {
      data: {
        companyId: string;
        type: KBType;
        title: string;
        content: string;
        sourceFile?: string | null;
      };
    }): Promise<KnowledgeItem> => {
      const item: KnowledgeItem = {
        id: randomUUID(),
        companyId: args.data.companyId,
        type: args.data.type,
        title: args.data.title,
        content: args.data.content,
        sourceFile: args.data.sourceFile ?? null,
        createdAt: new Date(),
      };
      this.knowledgeItems.push(item);
      return item;
    },
    findMany: async (args: {
      where: { companyId: string; type?: KBType };
    }): Promise<KnowledgeItem[]> => {
      return this.knowledgeItems.filter(
        (k) =>
          k.companyId === args.where.companyId &&
          (args.where.type ? k.type === args.where.type : true),
      );
    },
    findFirst: async (args: {
      where: { id: string; companyId: string };
    }): Promise<KnowledgeItem | null> => {
      return (
        this.knowledgeItems.find(
          (k) => k.id === args.where.id && k.companyId === args.where.companyId,
        ) ?? null
      );
    },
    update: async (args: {
      where: { id: string };
      data: Partial<KnowledgeItem>;
    }): Promise<KnowledgeItem> => {
      const item = this.knowledgeItems.find((k) => k.id === args.where.id);
      if (!item) throw new Error('KnowledgeItem introuvable');
      Object.assign(item, args.data);
      return item;
    },
    delete: async (args: { where: { id: string } }): Promise<KnowledgeItem> => {
      const index = this.knowledgeItems.findIndex((k) => k.id === args.where.id);
      if (index === -1) throw new Error('KnowledgeItem introuvable');
      return this.knowledgeItems.splice(index, 1)[0];
    },
  };

  private prospects: Prospect[] = [];
  private conversations: Conversation[] = [];
  private messages: Message[] = [];
  private notifications: Notification[] = [];

  prospect = {
    findFirst: async (args: {
      where: { companyId: string; phone: string };
    }): Promise<Prospect | null> => {
      return (
        this.prospects.find(
          (p) => p.companyId === args.where.companyId && p.phone === args.where.phone,
        ) ?? null
      );
    },
    create: async (args: { data: { companyId: string; phone: string } }): Promise<Prospect> => {
      const prospect: Prospect = {
        id: randomUUID(),
        companyId: args.data.companyId,
        phone: args.data.phone,
        name: null,
        email: null,
        score: ProspectScore.COLD,
        status: ProspectStatus.NEW,
        lastContact: null,
        createdAt: new Date(),
      };
      this.prospects.push(prospect);
      return prospect;
    },
    update: async (args: { where: { id: string }; data: Partial<Prospect> }): Promise<Prospect> => {
      const prospect = this.prospects.find((p) => p.id === args.where.id);
      if (!prospect) throw new Error('Prospect introuvable');
      Object.assign(prospect, args.data);
      return prospect;
    },
    count: async (args: {
      where: { companyId: string; score?: ProspectScore };
    }): Promise<number> => {
      return this.prospects.filter(
        (p) =>
          p.companyId === args.where.companyId &&
          (args.where.score ? p.score === args.where.score : true),
      ).length;
    },
    findMany: async (args: { where: { companyId: string } }): Promise<Prospect[]> => {
      return this.prospects.filter((p) => p.companyId === args.where.companyId);
    },
  };

  conversation = {
    findFirst: async (args: {
      where: { companyId: string; prospectPhone: string };
    }): Promise<Conversation | null> => {
      return (
        this.conversations.find(
          (c) =>
            c.companyId === args.where.companyId &&
            c.prospectPhone === args.where.prospectPhone &&
            c.status !== ConvStatus.CLOSED,
        ) ?? null
      );
    },
    create: async (args: {
      data: { companyId: string; prospectId: string; prospectPhone: string; status: ConvStatus };
    }): Promise<Conversation> => {
      const conversation: Conversation = {
        id: randomUUID(),
        companyId: args.data.companyId,
        prospectId: args.data.prospectId,
        prospectPhone: args.data.prospectPhone,
        status: args.data.status,
        startedAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.push(conversation);
      return conversation;
    },
    update: async (args: {
      where: { id: string };
      data: Partial<Conversation>;
    }): Promise<Conversation> => {
      const conversation = this.conversations.find((c) => c.id === args.where.id);
      if (!conversation) throw new Error('Conversation introuvable');
      Object.assign(conversation, args.data);
      return conversation;
    },
    findMany: async (args: { where: { companyId: string } }): Promise<Conversation[]> => {
      return this.conversations.filter((c) => c.companyId === args.where.companyId);
    },
  };

  message = {
    create: async (args: {
      data: { conversationId: string; sender: Sender; content: string };
    }): Promise<Message> => {
      const message: Message = {
        id: randomUUID(),
        conversationId: args.data.conversationId,
        sender: args.data.sender,
        content: args.data.content,
        type: 'TEXT',
        sentAt: new Date(),
      };
      this.messages.push(message);
      return message;
    },
    findMany: async (args: { where: { conversationId: string } }): Promise<Message[]> => {
      return this.messages.filter((m) => m.conversationId === args.where.conversationId);
    },
    count: async (args: { where: { conversation?: { companyId?: string } } }): Promise<number> => {
      const companyId = args.where.conversation?.companyId;
      if (!companyId) return this.messages.length;
      const convIds = new Set(
        this.conversations.filter((c) => c.companyId === companyId).map((c) => c.id),
      );
      return this.messages.filter((m) => convIds.has(m.conversationId)).length;
    },
  };

  notification = {
    create: async (args: {
      data: { companyId: string; type: NotifType; recipient: string; content: string };
    }): Promise<Notification> => {
      const notification: Notification = {
        id: randomUUID(),
        companyId: args.data.companyId,
        type: args.data.type,
        recipient: args.data.recipient,
        content: args.data.content,
        sent: false,
        read: false,
        sentAt: new Date(),
      };
      this.notifications.push(notification);
      return notification;
    },
    findMany: async (args: {
      where: { companyId: string };
      orderBy?: unknown;
      take?: number;
    }): Promise<Notification[]> => {
      const list = this.notifications
        .filter((n) => n.companyId === args.where.companyId)
        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
      return args.take ? list.slice(0, args.take) : list;
    },
    findFirst: async (args: {
      where: { id: string; companyId: string };
    }): Promise<Notification | null> => {
      return (
        this.notifications.find(
          (n) => n.id === args.where.id && n.companyId === args.where.companyId,
        ) ?? null
      );
    },
    update: async (args: {
      where: { id: string };
      data: Partial<Notification>;
    }): Promise<Notification> => {
      const notification = this.notifications.find((n) => n.id === args.where.id);
      if (!notification) throw new Error('Notification introuvable');
      Object.assign(notification, args.data);
      return notification;
    },
  };

  private products: Product[] = [];
  private orders: Order[] = [];
  private orderItems: OrderItem[] = [];

  product = {
    findFirst: async (args: {
      where: { companyId: string; name: string };
    }): Promise<Product | null> => {
      return (
        this.products.find(
          (p) => p.companyId === args.where.companyId && p.name === args.where.name,
        ) ?? null
      );
    },
    create: async (args: {
      data: {
        companyId: string;
        name: string;
        description: string;
        price: number;
        unit?: string;
        stock?: number | null;
      };
    }): Promise<Product> => {
      const product: Product = {
        id: randomUUID(),
        companyId: args.data.companyId,
        name: args.data.name,
        description: args.data.description,
        price: args.data.price,
        unit: args.data.unit ?? 'unité',
        stock: args.data.stock ?? null,
        imageUrl: null,
        variants: null,
        active: true,
        createdAt: new Date(),
      };
      this.products.push(product);
      return product;
    },
    update: async (args: { where: { id: string }; data: Partial<Product> }): Promise<Product> => {
      const product = this.products.find((p) => p.id === args.where.id);
      if (!product) throw new Error('Product introuvable');
      Object.assign(product, args.data);
      return product;
    },
    findMany: async (args: { where: { companyId: string } }): Promise<Product[]> => {
      return this.products.filter((p) => p.companyId === args.where.companyId);
    },
  };

  order = {
    create: async (args: {
      data: {
        companyId: string;
        prospectId: string;
        ref: string;
        total: number;
        status: OrderStatus;
        deliveryAddress?: string | null;
      };
    }): Promise<Order> => {
      const order: Order = {
        id: randomUUID(),
        companyId: args.data.companyId,
        prospectId: args.data.prospectId,
        ref: args.data.ref,
        total: args.data.total,
        status: args.data.status,
        deliveryAddress: args.data.deliveryAddress ?? null,
        delivererId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.orders.push(order);
      return order;
    },
    count: async (): Promise<number> => this.orders.length,
    findMany: async (args?: {
      where?: { companyId?: string; status?: { not?: OrderStatus } };
    }): Promise<Order[]> => {
      const companyId = args?.where?.companyId;
      const notStatus = args?.where?.status?.not;
      return this.orders.filter(
        (o) =>
          (companyId ? o.companyId === companyId : true) &&
          (notStatus ? o.status !== notStatus : true),
      );
    },
  };

  orderItem = {
    create: async (args: {
      data: {
        orderId: string;
        productId: string;
        quantity: number;
        unitPrice: number;
        total: number;
      };
    }): Promise<OrderItem> => {
      const item: OrderItem = { id: randomUUID(), ...args.data };
      this.orderItems.push(item);
      return item;
    },
  };

  // Stubs SQL brut (le vrai pgvector est testé en live) : embedding ignoré, recherche = items.
  $executeRaw = async (..._args: unknown[]): Promise<number> => 0;

  $queryRaw = async (..._args: unknown[]): Promise<unknown[]> =>
    this.knowledgeItems.map((k) => ({
      id: k.id,
      title: k.title,
      content: k.content,
      type: k.type,
      score: 0.9,
    }));

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

export class FakeRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) if (this.store.delete(key)) removed += 1;
    return removed;
  }
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      '^' +
        pattern
          .split('*')
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$',
    );
    return [...this.store.keys()].filter((key) => regex.test(key));
  }
  async incrWithTtl(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? '0') + 1;
    this.store.set(key, String(next));
    return next;
  }
  async ping(): Promise<boolean> {
    return true;
  }

  asService(): RedisService {
    return this as unknown as RedisService;
  }
}

export class FakeMail {
  lastTo: string | null = null;
  lastCode: string | null = null;

  async sendOtpEmail(to: string, code: string): Promise<void> {
    this.lastTo = to;
    this.lastCode = code;
  }

  asService(): MailService {
    return this as unknown as MailService;
  }
}

export class FakeUploadthing {
  async uploadLogo(companyId: string): Promise<string> {
    return `https://fake.utfs.io/z-app/${companyId}/logos/logo.webp`;
  }

  asService(): UploadthingService {
    return this as unknown as UploadthingService;
  }
}

export class FakeWhatsapp {
  onStatus(): void {
    // no-op pour les tests
  }
  onInboundMessage(): void {
    // no-op pour les tests
  }
  onMissedCall(): void {
    // no-op pour les tests
  }
  onInboundAudio(): void {
    // no-op pour les tests
  }
  async sendText(): Promise<void> {
    // no-op pour les tests
  }
  async sendVoice(): Promise<void> {
    // no-op pour les tests
  }
  async resolveCompanyId(): Promise<string> {
    return 'company-e2e';
  }
  async getQr(): Promise<WhatsappStatusPayload> {
    return { status: 'CONNECTING', qr: 'data:image/png;base64,AAAA' };
  }
  async getStatus(): Promise<WhatsappStatusPayload> {
    return { status: 'DISCONNECTED', phone: null };
  }
  async logout(): Promise<WhatsappStatusPayload> {
    return { status: 'DISCONNECTED' };
  }

  asService(): WhatsappService {
    return this as unknown as WhatsappService;
  }
}

export class FakeEmbedding {
  async embed(text: string): Promise<number[]> {
    // vecteur court déterministe (suffisant pour les tests ; le vrai RAG est testé en live)
    return [text.length % 7, (text.length * 3) % 11, 1];
  }

  asService(): EmbeddingService {
    return this as unknown as EmbeddingService;
  }
}

export class FakeAnthropic {
  public nextReply: NovaReply = {
    message: 'Bonjour ! Comment puis-je vous aider aujourd’hui ?',
    intent: 'INFO_QUERY',
    notifyManager: false,
    orderData: null,
  };

  async generateNovaReply(): Promise<NovaReply> {
    return this.nextReply;
  }

  get isLive(): boolean {
    return true;
  }

  asService(): AnthropicService {
    return this as unknown as AnthropicService;
  }
}

export function makeConfig(): ConfigService {
  const values: Record<string, string | number> = {
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    OTP_TTL_SECONDS: 600,
    REFRESH_TTL_SECONDS: 604800,
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
    WHATSAPP_ENC_SECRET: 'test-whatsapp-encryption-secret',
    NODE_ENV: 'test',
  };
  return {
    getOrThrow: <T>(key: string): T => values[key] as unknown as T,
    get: <T>(key: string): T => values[key] as unknown as T,
  } as unknown as ConfigService;
}
