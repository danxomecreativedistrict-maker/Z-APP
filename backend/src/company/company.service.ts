import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateNotificationsDto,
  UpdateNovaDto,
  UpdatePolicyDto,
} from './dto/company.dto';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export interface NovaConfig {
  novaName: string;
  novaTone: string;
  novaLanguage: string;
  welcomeMessage: string | null;
}

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Récupère la fiche de l'utilisateur courant (isolation stricte par userId). */
  async getMine(userId: string): Promise<Company> {
    const company = await this.prisma.company.findFirst({ where: { userId } });
    if (!company) {
      throw new NotFoundException("Aucune fiche entreprise. Veuillez la créer d'abord.");
    }
    return company;
  }

  async create(userId: string, dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.prisma.company.findFirst({ where: { userId } });
    if (existing) {
      throw new ConflictException('Une fiche entreprise existe déjà pour ce compte.');
    }
    return this.prisma.company.create({
      data: {
        userId,
        name: dto.name.trim(),
        sector: dto.sector,
        city: dto.city,
        country: dto.country ?? 'BJ',
        ownerPhone: dto.ownerPhone ?? '',
        managerPhone: dto.managerPhone ?? '',
      },
    });
  }

  async update(userId: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.getMine(userId);
    return this.prisma.company.update({ where: { id: company.id }, data: { ...dto } });
  }

  async getNova(userId: string): Promise<NovaConfig> {
    const company = await this.getMine(userId);
    return {
      novaName: company.novaName,
      novaTone: company.novaTone,
      novaLanguage: company.novaLanguage,
      welcomeMessage: company.welcomeMessage,
    };
  }

  async updateNova(userId: string, dto: UpdateNovaDto): Promise<Company> {
    const company = await this.getMine(userId);
    return this.prisma.company.update({ where: { id: company.id }, data: { ...dto } });
  }

  async updatePolicy(userId: string, dto: UpdatePolicyDto): Promise<Company> {
    const company = await this.getMine(userId);
    return this.prisma.company.update({ where: { id: company.id }, data: { ...dto } });
  }

  async updateNotifications(userId: string, dto: UpdateNotificationsDto): Promise<Company> {
    const company = await this.getMine(userId);
    return this.prisma.company.update({ where: { id: company.id }, data: { ...dto } });
  }

  async completeOnboarding(userId: string): Promise<Company> {
    const company = await this.getMine(userId);
    return this.prisma.company.update({
      where: { id: company.id },
      data: { onboardingDone: true },
    });
  }

  async uploadLogo(userId: string, file: Express.Multer.File | undefined): Promise<Company> {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    if (!ALLOWED_LOGO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Format invalide. Formats acceptés : JPG, PNG, WEBP.');
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('Le logo ne doit pas dépasser 2 Mo.');
    }
    const company = await this.getMine(userId);
    const logoUrl = await this.cloudinary.uploadLogo(company.id, file);
    return this.prisma.company.update({ where: { id: company.id }, data: { logoUrl } });
  }
}
