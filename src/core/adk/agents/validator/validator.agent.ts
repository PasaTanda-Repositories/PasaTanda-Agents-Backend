import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmAgent, Gemini } from '@google/adk';
import { PasatandaToolsService } from '../tools/pasatanda-tools.service';

/**
 * Sub-agente Validator: Maneja verificación de documentos y comprobantes
 *
 * Responsabilidades:
 * - Extraer información de comprobantes
 * - Validar documentos
 * - Procesar imágenes de pagos
 */
@Injectable()
export class AdkValidatorAgent {
  private readonly logger = new Logger(AdkValidatorAgent.name);
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

    const instruction = `Eres el Validador de PasaTanda, especializado en verificar comprobantes de pago.

FUNCIONES PRINCIPALES:
1. **Analizar comprobantes**: Extrae información de imágenes de comprobantes.
2. **Verificar pagos**: Usa verify_payment_proof para confirmar pagos.

PROCESO DE VERIFICACIÓN:
1. Usuario envía imagen del comprobante
2. Extraes: monto, banco/entidad, número de referencia, fecha
3. Comparas con la orden de pago pendiente
4. Confirmas o rechazas el pago

DATOS A EXTRAER DE COMPROBANTES:
- Monto de la transacción
- Banco o entidad financiera
- Número de referencia/confirmación
- Fecha y hora de la transacción
- Nombre del pagador (si está visible)

RESPUESTAS:
- Si falta información en el comprobante, solicita una foto más clara
- Confirma los datos extraídos antes de verificar
- Explica el motivo si rechazas un comprobante
- Usa emojis para hacer las respuestas más amigables 🔍`;

    this.agent = new LlmAgent({
      name: 'validator',
      model,
      instruction,
      description:
        'Agente especializado en verificar comprobantes de pago y extraer información',
      tools: [this.tools.verifyPaymentProofTool],
    });

    this.logger.log('Validator Agent inicializado');
  }
}
