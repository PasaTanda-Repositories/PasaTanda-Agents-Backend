import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './common/intraestructure/supabase/supabase.service';
import { SupabaseSessionService } from './core/adk/session/supabase-session.service';
import { AdkOrchestratorService } from './core/adk/orchestrator/adk-orchestrator.service';
import { OrchestratorToolsService } from './core/adk/orchestrator/orchestrator.tools';
import { AdkGameMasterAgent } from './core/adk/agents/game-master/game-master.agent';
import { AdkTreasurerAgent } from './core/adk/agents/treasurer/treasurer.agent';
import { AdkValidatorAgent } from './core/adk/agents/validator/validator.agent';
import { GameMasterToolsService } from './core/adk/agents/game-master/game-master.tools';
import { TreasurerToolsService } from './core/adk/agents/treasurer/treasurer.tools';
import { ValidatorToolsService } from './core/adk/agents/validator/validator.tools';
import { GroupCreationService } from './features/groups/services/group-creation.service';
import { GroupWorkflowService } from './features/groups/services/group-workflow.service';
import { VerificationService } from './features/login/verification.service';
import { FrontendWebhookService } from './features/login/frontend-webhook.service';
import { PaymentIntegrationService } from './features/payments/payment-integration.service';
import { PaymentWorkflowService } from './features/payments/payment-workflow.service';
import { WhatsAppMessagingService } from './features/whatsapp/services/whatsapp.messaging.service';
import { WhatsappService } from './features/whatsapp/services/whatsapp.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  controllers: [AppController],
  providers: [
    AppService,
    SupabaseService,
    SupabaseSessionService,
    GroupCreationService,
    GroupWorkflowService,
    VerificationService,
    FrontendWebhookService,
    PaymentIntegrationService,
    PaymentWorkflowService,
    WhatsAppMessagingService,
    WhatsappService,
    OrchestratorToolsService,
    AdkOrchestratorService,
    AdkGameMasterAgent,
    AdkTreasurerAgent,
    AdkValidatorAgent,
    GameMasterToolsService,
    TreasurerToolsService,
    ValidatorToolsService,
  ],
})
export class AppModule {}
