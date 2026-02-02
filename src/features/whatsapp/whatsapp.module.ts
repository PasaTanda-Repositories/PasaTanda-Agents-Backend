import { WhatsappController } from './controllers/whatsapp.controller';
import { WhatsappService } from './services/whatsapp.service';
import { WhatsAppMessagingService } from './services/whatsapp.messaging.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsAppMessagingService],
  exports: [WhatsappService, WhatsAppMessagingService],
})
export class WhatsappModule {}
