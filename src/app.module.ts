import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './common/intraestructure/infrastructure.module';
import { SecurityModule } from './common/security/security.module';
import { AuthModule } from './features/auth/auth.module';
import { GroupsModule } from './features/groups/groups.module';
import { LoginModule } from './features/login/login.module';
import { PaymentsModule } from './features/payments/payments.module';
import { WhatsappModule } from './features/whatsapp/whatsapp.module';
import { WebhooksModule } from './features/webhooks/webhooks.module';
import { AdkModule } from './core/adk/adk.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InfrastructureModule,
    SecurityModule,
    LoginModule,
    AuthModule,
    GroupsModule,
    PaymentsModule,
    AdkModule,
    WhatsappModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
