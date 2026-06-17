import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NovaService } from './nova.service';
import { TranscriptionService } from './transcription.service';
import { TtsService } from './tts.service';

/**
 * Relie les événements WhatsApp (Module 4) au cerveau NOVA (Module 6) :
 * - message texte → NOVA → réponse texte,
 * - appel manqué → message d'accueil automatique + notification gérant,
 * - note vocale → transcription Whisper → NOVA → réponse VOCALE (TTS), repli texte.
 */
@Injectable()
export class NovaWhatsappBridge implements OnModuleInit {
  private readonly logger = new Logger(NovaWhatsappBridge.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly nova: NovaService,
    private readonly transcription: TranscriptionService,
    private readonly tts: TtsService,
  ) {}

  onModuleInit(): void {
    this.whatsapp.onInboundMessage((companyId, from, text) => {
      void this.processText(companyId, from, text);
    });
    this.whatsapp.onMissedCall((companyId, from) => {
      void this.processMissedCall(companyId, from);
    });
    this.whatsapp.onInboundAudio((companyId, from, audio, mimetype) => {
      void this.processAudio(companyId, from, audio, mimetype);
    });
  }

  private async processText(companyId: string, from: string, text: string): Promise<void> {
    try {
      const result = await this.nova.handleIncomingMessage(companyId, from, text);
      await this.whatsapp.sendText(companyId, from, result.reply);
    } catch (err) {
      this.logger.error(
        `Échec message texte : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async processMissedCall(companyId: string, from: string): Promise<void> {
    try {
      const result = await this.nova.handleMissedCall(companyId, from);
      await this.whatsapp.sendText(companyId, from, result.reply);
    } catch (err) {
      this.logger.error(`Échec appel manqué : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async processAudio(
    companyId: string,
    from: string,
    audio: Buffer,
    mimetype: string,
  ): Promise<void> {
    try {
      const text = await this.transcription.transcribe(audio, mimetype);
      const result = await this.nova.handleIncomingMessage(companyId, from, text);
      // Le prospect a parlé → NOVA répond aussi à la voix (note vocale), repli texte si TTS indispo.
      const voice = await this.tts.synthesize(result.reply);
      if (voice) {
        await this.whatsapp.sendVoice(companyId, from, voice.audio, voice.mimetype);
      } else {
        await this.whatsapp.sendText(companyId, from, result.reply);
      }
    } catch (err) {
      this.logger.error(`Échec note vocale : ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
