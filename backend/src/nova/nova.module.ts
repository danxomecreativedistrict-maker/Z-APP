import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnthropicService } from './anthropic.service';
import { TranscriptionService } from './transcription.service';
import { TtsService } from './tts.service';
import { NovaController } from './nova.controller';
import { NovaService } from './nova.service';
import { NovaWhatsappBridge } from './nova-whatsapp.bridge';

@Module({
  imports: [KnowledgeModule, WhatsappModule, OrdersModule, NotificationsModule],
  controllers: [NovaController],
  providers: [AnthropicService, TranscriptionService, TtsService, NovaService, NovaWhatsappBridge],
})
export class NovaModule {}
