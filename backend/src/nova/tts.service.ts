import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Modèle TTS OpenAI (synthèse vocale). Format Opus/OGG = note vocale WhatsApp.
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'alloy';
const MAX_CHARS = 1200; // borne le coût/latence d'une note vocale.

export interface SynthesizedVoice {
  audio: Buffer;
  mimetype: string;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const key = config.get<string>('OPENAI_API_KEY');
    const configured = Boolean(key && key.startsWith('sk-') && key.length > 20);
    this.client = configured && key ? new OpenAI({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY absente → synthèse vocale désactivée (NOVA répondra en texte).',
      );
    }
  }

  get isLive(): boolean {
    return this.client !== null;
  }

  /**
   * Synthétise un texte en note vocale (Opus/OGG, prête pour WhatsApp `ptt`).
   * Retourne null si la clé OpenAI est absente ou en cas d'échec (repli texte par l'appelant).
   */
  async synthesize(text: string): Promise<SynthesizedVoice | null> {
    if (!this.client) return null;
    const input = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
    if (!input) return null;
    try {
      const res = await this.client.audio.speech.create({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input,
        response_format: 'opus',
      });
      const audio = Buffer.from(await res.arrayBuffer());
      return { audio, mimetype: 'audio/ogg; codecs=opus' };
    } catch (err) {
      this.logger.error(
        `Échec de la synthèse vocale : ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
