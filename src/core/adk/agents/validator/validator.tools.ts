import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { PaymentWorkflowService } from '../../../../features/payments/payment-workflow.service';

@Injectable()
export class ValidatorToolsService {
  constructor(private readonly payments: PaymentWorkflowService) {}

  get verifyPaymentProofTool(): FunctionTool {
    return new FunctionTool({
      name: 'verify_payment_proof',
      description:
        'Marca el comprobante como recibido y avisa que será revisado.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.payments.verifyProofPlaceholder({
          senderPhone: args.senderPhone,
        });
        return { acknowledged: true };
      },
    });
  }

  get allTools(): FunctionTool[] {
    return [this.verifyPaymentProofTool];
  }
}

