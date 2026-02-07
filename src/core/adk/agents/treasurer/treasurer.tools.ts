import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { PaymentWorkflowService } from '../../../../features/payments/payment-workflow.service';

@Injectable()
export class TreasurerToolsService {
  constructor(private readonly payments: PaymentWorkflowService) {}

  get createPaymentLinkTool(): FunctionTool {
    return new FunctionTool({
      name: 'create_payment_link',
      description: 'Genera un link/QR de pago y notifica al usuario.',
      parameters: z.object({
        senderPhone: z.string(),
        orderId: z.string(),
        amountUsd: z.number(),
        description: z.string().optional(),
      }),
      execute: async (args) => {
        await this.payments.createPaymentLink(args);
        return { acknowledged: true };
      },
    });
  }

  get verifyPaymentProofTool(): FunctionTool {
    return new FunctionTool({
      name: 'verify_payment_proof',
      description: 'Confirma que se recibió un comprobante y se verificará.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.payments.verifyProofPlaceholder({
          senderPhone: args.senderPhone,
        });
        return { acknowledged: true };
      },
    });
  }

  get choosePayoutMethodTool(): FunctionTool {
    return new FunctionTool({
      name: 'choose_payout_method',
      description: 'Selecciona el método de retiro del ganador.',
      parameters: z.object({
        senderPhone: z.string(),
        method: z.enum(['FIAT', 'USDC', 'LATER']),
      }),
      execute: async (args) => {
        await this.payments.choosePayoutPlaceholder({
          senderPhone: args.senderPhone,
          method: args.method,
        });
        return { acknowledged: true };
      },
    });
  }

  get getUserInfoTool(): FunctionTool {
    return new FunctionTool({
      name: 'get_user_info',
      description: 'Obtiene información financiera básica del usuario.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.payments.sendUserInfoPlaceholder(args.senderPhone);
        return { acknowledged: true };
      },
    });
  }

  get allTools(): FunctionTool[] {
    return [
      this.createPaymentLinkTool,
      this.verifyPaymentProofTool,
      this.getUserInfoTool,
      this.choosePayoutMethodTool,
    ];
  }
}
