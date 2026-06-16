import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway],
})
export class WhatsappModule {}
