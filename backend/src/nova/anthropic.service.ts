import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { NovaReply, NovaReplySchema, NovaTurn } from './nova.types';

// Modèle imposé par le brief Z-APP (NOVA). ID exact, sans suffixe de date.
const NOVA_MODEL = 'claude-sonnet-4-6';

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    const key = config.get<string>('ANTHROPIC_API_KEY');
    const configured = Boolean(key && key.startsWith('sk-ant-') && key.length > 20);
    this.client = configured && key ? new Anthropic({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY absente/placeholder → NOVA répond en mode démo.');
    }
  }

  get isLive(): boolean {
    return this.client !== null;
  }

  /**
   * Génère la réponse de NOVA. Le prompt impose un JSON strict ; on le parse et le
   * valide (Zod). En cas de réponse non-JSON, on retombe sur le texte brut comme message.
   */
  async generateNovaReply(system: string, turns: NovaTurn[]): Promise<NovaReply> {
    if (!this.client) {
      return {
        message:
          'Bonjour 👋 Je suis NOVA en mode démo (clé Anthropic non configurée). Configurez ANTHROPIC_API_KEY pour des réponses réelles. Comment puis-je vous aider ?',
        intent: 'INFO_QUERY',
        notifyManager: false,
        orderData: null,
      };
    }
    try {
      const res = await this.client.messages.create({
        model: NOVA_MODEL,
        max_tokens: 1024,
        system,
        messages: turns.map((turn) => ({ role: turn.role, content: turn.content })),
      });
      const block = res.content.find((b) => b.type === 'text');
      const raw = block && block.type === 'text' ? block.text : '';
      return this.parseReply(raw);
    } catch (err) {
      this.logger.error(`Erreur Claude : ${err instanceof Error ? err.message : String(err)}`);
      return this.fallback();
    }
  }

  private parseReply(raw: string): NovaReply {
    // Retire les éventuelles balises Markdown (```json … ```) avant d'isoler le JSON.
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        const parsed = NovaReplySchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
        if (parsed.success) return parsed.data;
      } catch {
        // JSON invalide : on bascule sur le texte brut ci-dessous
      }
    }
    if (cleaned) {
      return { message: cleaned, intent: 'INFO_QUERY', notifyManager: false, orderData: null };
    }
    return this.fallback();
  }

  private fallback(): NovaReply {
    return {
      message:
        "Je rencontre une difficulté technique. Un conseiller de l'équipe vous recontactera très vite.",
      intent: 'HUMAN_REQUEST',
      notifyManager: true,
      orderData: null,
    };
  }
}
