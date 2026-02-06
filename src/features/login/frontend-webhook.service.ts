import { Injectable, Logger } from '@nestjs/common';
import type { VerificationConfirmationPayload } from './types/verification.types';

@Injectable()
export class FrontendWebhookService {
  private readonly logger = new Logger(FrontendWebhookService.name);

  async sendVerificationConfirmation(
    payload: VerificationConfirmationPayload,
  ): Promise<void> {
    // Placeholder para integración futura con el frontend (webhook o cola)
    this.logger.debug(
      `Webhook de verificación pendiente: ${payload.phone} verificado=${payload.verified}`,
    );
  }
}
