import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { OrdersModule } from '../orders/orders.module';
import { AnthropicService } from './anthropic.service';
import { TranscriptionService } from './transcription.service';
import { NovaController } from './nova.controller';
import { NovaService } from './nova.service';
import { NovaWhatsappBridge } from './nova-whatsapp.bridge';

@Module({
  imports: [KnowledgeModule, WhatsappModule, OrdersModule],
  controllers: [NovaController],
  providers: [AnthropicService, TranscriptionService, NovaService, NovaWhatsappBridge],
})
export class NovaModule {}
