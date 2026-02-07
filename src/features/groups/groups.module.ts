import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../common/intraestructure/infrastructure.module';
import { SecurityModule } from '../../common/security/security.module';
import { WhatsappMessagingModule } from '../whatsapp/whatsapp-messaging.module';
import { GroupsController } from './groups.controller';
import { GroupService } from './services/group.service';
import { GroupMessagingService } from './services/group-messaging.service';

@Module({
  imports: [InfrastructureModule, SecurityModule, WhatsappMessagingModule],
  controllers: [GroupsController],
  providers: [GroupService, GroupMessagingService],
  exports: [GroupMessagingService, GroupService],
})
export class GroupsModule {}
