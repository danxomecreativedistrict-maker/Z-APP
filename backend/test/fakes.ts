// Fakes in-memory typés pour tester auth + company sans Neon/Upstash/Resend/Cloudinary réels.
import { ConfigService } from '@nestjs/config';
import { Company, Plan, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { MailService } from '../src/mail/mail.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';

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

export class FakeCloudinary {
  async uploadLogo(companyId: string): Promise<string> {
    return `https://fake.cdn/z-app/${companyId}/logos/logo.webp`;
  }

  asService(): CloudinaryService {
    return this as unknown as CloudinaryService;
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
    NODE_ENV: 'test',
  };
  return {
    getOrThrow: <T>(key: string): T => values[key] as unknown as T,
    get: <T>(key: string): T => values[key] as unknown as T,
  } as unknown as ConfigService;
}
