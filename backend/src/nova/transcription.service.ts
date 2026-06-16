import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';

const WHISPER_MODEL = 'whisper-1';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const key = config.get<string>('OPENAI_API_KEY');
    const configured = Boolean(key && key.startsWith('sk-') && key.length > 20);
    this.client = configured && key ? new OpenAI({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY absente → transcription vocale en mode démo (placeholder).');
    }
  }

  /** Transcrit une note vocale WhatsApp via Whisper. Repli en placeholder si pas de clé. */
  async transcribe(audio: Buffer, mimetype: string): Promise<string> {
    if (!this.client) {
      return '[Note vocale reçue — transcription indisponible sans clé OpenAI.]';
    }
    try {
      const ext = mimetype.includes('ogg')
        ? 'ogg'
        : mimetype.includes('mp4') || mimetype.includes('m4a')
          ? 'm4a'
          : 'mp3';
      const file = await toFile(audio, `voice.${ext}`, { type: mimetype });
      const res = await this.client.audio.transcriptions.create({ file, model: WHISPER_MODEL });
      return res.text?.trim() || '[Note vocale vide]';
    } catch (err) {
      this.logger.error(
        `Échec de la transcription Whisper : ${err instanceof Error ? err.message : String(err)}`,
      );
      return '[Note vocale reçue — la transcription a échoué.]';
    }
  }
}
