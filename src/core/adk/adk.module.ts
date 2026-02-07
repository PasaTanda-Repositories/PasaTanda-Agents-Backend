import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureModule } from '../../common/intraestructure/infrastructure.module';
import { LoginModule } from '../../features/login/login.module';
import { GroupsModule } from '../../features/groups/groups.module';
import { PaymentsModule } from '../../features/payments/payments.module';
import { AdkOrchestratorService } from './orchestrator/adk-orchestrator.service';
import { OrchestratorToolsService } from './orchestrator/orchestrator.tools';
import { AdkGameMasterAgent } from './agents/game-master/game-master.agent';
import { AdkTreasurerAgent } from './agents/treasurer/treasurer.agent';
import { AdkValidatorAgent } from './agents/validator/validator.agent';
import { GameMasterToolsService } from './agents/game-master/game-master.tools';
import { TreasurerToolsService } from './agents/treasurer/treasurer.tools';
import { ValidatorToolsService } from './agents/validator/validator.tools';
import { SupabaseSessionService } from './session/supabase-session.service';

@Module({
  imports: [ConfigModule, InfrastructureModule, LoginModule, GroupsModule, PaymentsModule],
  providers: [
    AdkOrchestratorService,
    OrchestratorToolsService,
    AdkGameMasterAgent,
    AdkTreasurerAgent,
    AdkValidatorAgent,
    GameMasterToolsService,
    TreasurerToolsService,
    ValidatorToolsService,
    SupabaseSessionService,
  ],
  exports: [AdkOrchestratorService],
})
export class AdkModule {}
