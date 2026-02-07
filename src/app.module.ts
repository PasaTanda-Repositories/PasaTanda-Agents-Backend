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
import { AuthController } from './features/auth/auth.controller';
import { AuthService } from './features/auth/auth.service';
import { TokenService } from './common/security/token.service';
import { GroupsController } from './features/groups/groups.controller';
import { TransactionsController } from './features/payments/transactions.controller';
import { WhatsappModule } from './features/whatsapp/whatsapp.module';
import { ExternalWebhooksController } from './features/webhooks/webhooks.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    WhatsappModule,
  ],
  controllers: [
    AppController,
    AuthController,
    GroupsController,
    TransactionsController,
    ExternalWebhooksController,
  ],
  providers: [
    AppService,
    SupabaseService,
    SupabaseSessionService,
    TokenService,
    AuthService,
    GroupCreationService,
    GroupWorkflowService,
    VerificationService,
    FrontendWebhookService,
    PaymentIntegrationService,
    PaymentWorkflowService,
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
