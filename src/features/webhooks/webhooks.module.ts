import { Module } from '@nestjs/common';
import { ExternalWebhooksController } from './webhooks.controller';

@Module({
  controllers: [ExternalWebhooksController],
})
export class WebhooksModule {}
