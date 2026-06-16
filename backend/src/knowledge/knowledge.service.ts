import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KBType, KnowledgeItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { CreateKnowledgeDto, ProductRowDto, UpdateKnowledgeDto } from './dto/knowledge.dto';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async create(userId: string, dto: CreateKnowledgeDto): Promise<KnowledgeItem> {
    const companyId = await this.resolveCompanyId(userId);
    const item = await this.prisma.knowledgeItem.create({
      data: {
        companyId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        sourceFile: dto.sourceFile,
      },
    });
    await this.embedItem(item.id, `${dto.title}\n${dto.content}`);
    return item;
  }

  async list(userId: string, type?: KBType): Promise<KnowledgeItem[]> {
    const companyId = await this.resolveCompanyId(userId);
    return this.prisma.knowledgeItem.findMany({
      where: { companyId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(userId: string, id: string): Promise<KnowledgeItem> {
    const companyId = await this.resolveCompanyId(userId);
    const item = await this.prisma.knowledgeItem.findFirst({ where: { id, companyId } });
    if (!item) {
      throw new NotFoundException('Élément de base de connaissances introuvable.');
    }
    return item;
  }

  async update(userId: string, id: string, dto: UpdateKnowledgeDto): Promise<KnowledgeItem> {
    const item = await this.getOne(userId, id);
    const updated = await this.prisma.knowledgeItem.update({
      where: { id: item.id },
      data: { ...dto },
    });
    if (dto.title !== undefined || dto.content !== undefined) {
      await this.embedItem(updated.id, `${updated.title}\n${updated.content}`);
    }
    return updated;
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const item = await this.getOne(userId, id);
    await this.prisma.knowledgeItem.delete({ where: { id: item.id } });
    return { deleted: true };
  }

  async importProducts(userId: string, products: ProductRowDto[]): Promise<{ imported: number }> {
    const companyId = await this.resolveCompanyId(userId);
    let imported = 0;
    for (const product of products) {
      const content = this.formatProduct(product);
      const item = await this.prisma.knowledgeItem.create({
        data: { companyId, type: KBType.PRODUCT, title: product.name, content },
      });
      await this.embedItem(item.id, `${product.name}\n${content}`);
      imported += 1;
    }
    this.logger.log(`${imported} produit(s) importé(s) pour l'entreprise ${companyId}`);
    return { imported };
  }

  async importFile(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ chunks: number }> {
    const companyId = await this.resolveCompanyId(userId);
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    const text = (await this.extractText(file)).replace(/\s+/g, ' ').trim();
    if (!text) {
      throw new BadRequestException('Aucun texte exploitable extrait du fichier.');
    }
    const chunks = this.chunkText(text, 1500);
    for (let i = 0; i < chunks.length; i += 1) {
      const item = await this.prisma.knowledgeItem.create({
        data: {
          companyId,
          type: KBType.DOCUMENT,
          title: `${file.originalname} (${i + 1}/${chunks.length})`,
          content: chunks[i],
          sourceFile: file.originalname,
        },
      });
      await this.embedItem(item.id, chunks[i]);
    }
    return { chunks: chunks.length };
  }

  /** Recherche sémantique top-k (cosine) pour l'utilisateur courant. */
  async search(userId: string, query: string, k = 5): Promise<SearchResult[]> {
    const companyId = await this.resolveCompanyId(userId);
    return this.searchByCompany(companyId, query, k);
  }

  /** Recherche sémantique top-k (cosine) par entreprise — utilisée par NOVA (Module 6). */
  async searchByCompany(companyId: string, query: string, k = 5): Promise<SearchResult[]> {
    const vec = this.toVector(await this.embeddings.embed(query));
    const rows = await this.prisma.$queryRaw<SearchResult[]>`
      SELECT id, title, content, type::text AS type,
             1 - (embedding <=> ${vec}::vector) AS score
      FROM "KnowledgeItem"
      WHERE "companyId" = ${companyId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vec}::vector
      LIMIT ${k}
    `;
    return rows.map((row) => ({ ...row, score: Number(row.score) }));
  }

  // ───────────────────────── Helpers ─────────────────────────
  private async resolveCompanyId(userId: string): Promise<string> {
    const company = await this.prisma.company.findFirst({ where: { userId } });
    if (!company) {
      throw new NotFoundException("Aucune fiche entreprise. Veuillez la créer d'abord.");
    }
    return company.id;
  }

  private async embedItem(id: string, text: string): Promise<void> {
    const vec = this.toVector(await this.embeddings.embed(text));
    await this.prisma
      .$executeRaw`UPDATE "KnowledgeItem" SET embedding = ${vec}::vector WHERE id = ${id}`;
  }

  private toVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  private formatProduct(product: ProductRowDto): string {
    const lines = [`Produit : ${product.name}`];
    if (product.description) lines.push(`Description : ${product.description}`);
    if (product.price !== undefined) {
      lines.push(`Prix : ${product.price} ${product.unit ?? ''}`.trim());
    }
    if (product.stock !== undefined) lines.push(`Stock : ${product.stock}`);
    return lines.join('\n');
  }

  private chunkText(text: string, maxLen: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    let current = '';
    for (const word of words) {
      if (current.length + word.length + 1 > maxLen && current) {
        chunks.push(current.trim());
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(file.buffer);
      return data.text;
    }
    if (file.mimetype === DOCX_MIME || file.mimetype === DOC_MIME) {
      const { extractRawText } = await import('mammoth');
      const result = await extractRawText({ buffer: file.buffer });
      return result.value;
    }
    throw new BadRequestException('Format non supporté. Formats acceptés : PDF, Word (.docx).');
  }
}
