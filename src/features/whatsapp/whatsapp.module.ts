import { WhatsappController } from './controllers/whatsapp.controller';
import { WhatsappService } from './services/whatsapp.service';
import { WhatsAppMessagingService } from './services/whatsapp.messaging.service';
import { Module } from '@nestjs/common';
import { VerificationService } from '../login/verification.service';
import { SupabaseService } from '../../common/intraestructure/supabase/supabase.service';

@Module({
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsAppMessagingService,
    VerificationService,
    SupabaseService,
  ],
  exports: [WhatsappService, WhatsAppMessagingService],
})
export class WhatsappModule {}
