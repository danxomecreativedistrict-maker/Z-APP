import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1536;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const key = config.get<string>('OPENAI_API_KEY');
    const configured = Boolean(key && key.startsWith('sk-') && key.length > 20);
    this.client = configured ? new OpenAI({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY absente/placeholder → embeddings déterministes locaux (mode dev).',
      );
    }
  }

  async embed(text: string): Promise<number[]> {
    const input = text.replace(/\s+/g, ' ').trim().slice(0, 8000) || ' ';
    if (!this.client) {
      return this.devEmbedding(input);
    }
    const res = await this.client.embeddings.create({ model: EMBEDDING_MODEL, input });
    return res.data[0].embedding;
  }

  /**
   * Embedding déterministe (sac de mots hachés, normalisé L2) pour le dev hors-ligne :
   * deux textes partageant des mots obtiennent une similarité cosinus plus élevée,
   * ce qui suffit à valider le pipeline RAG sans appeler OpenAI.
   */
  private devEmbedding(text: string): number[] {
    const vec = new Array<number>(EMBEDDING_DIMS).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
    for (const token of tokens) {
      const hash = createHash('sha256').update(token).digest();
      for (let i = 0; i < EMBEDDING_DIMS; i += 1) {
        vec[i] += hash[i % hash.length] / 255 - 0.5;
      }
    }
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
