import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NovaService } from './nova.service';

/**
 * Relie les messages WhatsApp entrants (Module 4) au cerveau NOVA (Module 6) :
 * message entrant → NOVA → réponse renvoyée au prospect via WhatsApp.
 */
@Injectable()
export class NovaWhatsappBridge implements OnModuleInit {
  private readonly logger = new Logger(NovaWhatsappBridge.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly nova: NovaService,
  ) {}

  onModuleInit(): void {
    this.whatsapp.onInboundMessage((companyId, from, text) => {
      void this.process(companyId, from, text);
    });
  }

  private async process(companyId: string, from: string, text: string): Promise<void> {
    try {
      const result = await this.nova.handleIncomingMessage(companyId, from, text);
      await this.whatsapp.sendText(companyId, from, result.reply);
    } catch (err) {
      this.logger.error(
        `Échec du traitement du message WhatsApp : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
