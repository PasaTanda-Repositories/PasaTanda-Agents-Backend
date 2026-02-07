import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupCreationService } from './services/group-creation.service';
import { GroupWorkflowService } from './services/group-workflow.service';
import { InfrastructureModule } from '../../common/intraestructure/infrastructure.module';
import { SecurityModule } from '../../common/security/security.module';
import { WhatsappMessagingModule } from '../whatsapp/whatsapp-messaging.module';

@Module({
  imports: [InfrastructureModule, SecurityModule, WhatsappMessagingModule],
  controllers: [GroupsController],
  providers: [GroupCreationService, GroupWorkflowService],
  exports: [GroupWorkflowService, GroupCreationService],
})
export class GroupsModule {}
