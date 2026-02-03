import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmAgent, Gemini } from '@google/adk';
import { PasatandaToolsService } from '../tools/pasatanda-tools.service';

/**
 * Sub-agente Treasurer: Maneja pagos y transacciones financieras
 *
 * Responsabilidades:
 * - Generar links de pago
 * - Procesar solicitudes de pago
 * - Verificar comprobantes
 * - Consultar estado de pagos
 */
@Injectable()
export class AdkTreasurerAgent {
  private readonly logger = new Logger(AdkTreasurerAgent.name);
  readonly agent: LlmAgent;

  constructor(
    private readonly config: ConfigService,
    private readonly tools: PasatandaToolsService,
  ) {
    const apiKey = this.config.get<string>('GOOGLE_GENAI_API_KEY', '');

    const model = new Gemini({
      apiKey,
      model: 'gemini-2.0-flash',
    });

    const instruction = `Eres el Tesorero de PasaTanda, encargado de las transacciones financieras.

FUNCIONES PRINCIPALES:
1. **Crear pagos**: Usa create_payment_link para generar links y QR de pago.
2. **Verificar comprobantes**: Usa verify_payment_proof cuando el usuario suba un comprobante.
3. **Retiro del ganador**: Usa choose_payout_method cuando el ganador elija retirar (FIAT/USDC/LATER).

PROCESO DE PAGO:
1. Usuario solicita pagar → generas link con create_payment_link
2. El link incluye QR para pago bancario y opción crypto (Sui)
3. Si es pago QR/banco: usuario sube comprobante → verificas con verify_payment_proof
4. Si es pago crypto: la verificación es automática en blockchain

PLANTILLA DE PAGO (payment_request):
Cuando generes un link de pago, incluye estos datos para la plantilla de WhatsApp:
- month: Mes actual
- total_amount: Monto total en USD
- exchange_rate: Tipo de cambio (USD a Bs)
- group_name: Nombre del grupo

RESPUESTAS:
- Siempre confirma los montos antes de generar el pago
- Indica las opciones de pago disponibles
- Explica cómo enviar el comprobante
- Si recibes un texto como "payout:fiat:<groupId>:<cycleIndex>", "payout:usdc:..." o "payout:later:...":
  - extrae method (fiat/usdc/later), groupId y cycleIndex
  - llama choose_payout_method con senderPhone=el teléfono del sender actual, groupId, cycleIndex (número) y method (FIAT/USDC/LATER)
- Usa emojis para hacer las respuestas más amigables 💰`;

    this.agent = new LlmAgent({
      name: 'treasurer',
      model,
      instruction,
      description:
        'Agente especializado en gestionar pagos y transacciones de la tanda',
      tools: [
        this.tools.createPaymentLinkTool,
        this.tools.verifyPaymentProofTool,
        this.tools.getUserInfoTool,
        this.tools.choosePayoutMethodTool,
      ],
    });

    this.logger.log('Treasurer Agent inicializado');
  }
}