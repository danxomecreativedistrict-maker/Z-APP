import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AnthropicService } from './anthropic.service';
import { NovaController } from './nova.controller';
import { NovaService } from './nova.service';
import { NovaWhatsappBridge } from './nova-whatsapp.bridge';

@Module({
  imports: [KnowledgeModule, WhatsappModule],
  controllers: [NovaController],
  providers: [AnthropicService, NovaService, NovaWhatsappBridge],
})
export class NovaModule {}
