import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Gemini,
  LlmAgent,
  Runner,
  isFinalResponse,
  stringifyContent,
} from '@google/adk';
import { SupabaseSessionService } from '../session/supabase-session.service';
import {
  AdkGameMasterAgent,
  AdkTreasurerAgent,
  AdkValidatorAgent,
} from '../agents/adk-subagents';
import { OrchestratorToolsService } from './orchestrator.tools';
import type { RouterMessageContext } from '../../../features/whatsapp/types/whatsapp.types';
import type {
  OrchestrationResult,
  PasatandaIntent,
} from './orchestrator.types';

/**
 * Orquestador principal de PasaTanda usando Google ADK.
 *
 * Arquitectura multi-agente:
 * - Orchestrator (este agente): Clasifica intenciones y delega a sub-agentes
 * - Game Master: Gestión de grupos y tandas
 * - Treasurer: Pagos y transacciones
 * - Validator: Verificación de comprobantes
 *
 * La verificación de teléfono se maneja como tool dedicada del orquestador.
 */
@Injectable()
export class AdkOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(AdkOrchestratorService.name);
  private readonly appName = 'pasatanda';
  private runner!: Runner;
  private orchestratorAgent!: LlmAgent;

  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SupabaseSessionService,
    private readonly orchestratorTools: OrchestratorToolsService,
    private readonly gameMasterAgent: AdkGameMasterAgent,
    private readonly treasurerAgent: AdkTreasurerAgent,
    private readonly validatorAgent: AdkValidatorAgent,
  ) {}

  onModuleInit() {
    this.initializeOrchestrator();
  }

  private initializeOrchestrator(): void {
    const apiKey = this.config.get<string>('GOOGLE_GENAI_API_KEY', '');
    const model = new Gemini({ apiKey, model: 'gemini-2.0-flash' });

    const orchestratorInstruction = `Eres el orquestador principal de PasaTanda, una aplicación de tandas (grupos de ahorro rotativo) en WhatsApp.

  TU ROL:
  - Identifica la intención del usuario.
  - DEBES delegar al subagente correcto (transferencia) para ejecutar tools de negocio.
  - EXCEPCIÓN: la verificación de teléfono se ejecuta únicamente desde el orquestador con el tool \`verify_phone_code\`.

  SUBAGENTES DISPONIBLES (transfiere según corresponda):
  1) \`game_master\`: creación/gestión de grupos, participantes, configuración, estado.
  2) \`treasurer\`: pagos, generación de links/QR, validaciones relacionadas a pagos.
  3) \`validator\`: análisis/verificación de comprobantes y datos extraídos.

  REGLAS DE TOOLS:
  - No llames herramientas de grupos/pagos directamente desde el orquestador.
  - Sólo puedes llamar \`verify_phone_code\`.

  INTENCIONES PRINCIPALES:
  - **VERIFICAR TELÉFONO**: el usuario envía un OTP (p.ej. ABC123) con un mensaje tipo "mi codigo de verificacion es ...". Extrae el código (6 caracteres) y pásalo a \`verify_phone_code\`.
  - **CREAR/CONFIGURAR/CONSULTAR**: transfiere a \`game_master\`.
  - **GESTIONAR INVITACIONES A TANDAS**: códigos de 8 caracteres → \`game_master\`.
  - **PAGAR**: transfiere a \`treasurer\`.
  - **RETIRO GANADOR**: textos payout:fiat/usdc/later → \`treasurer\`.
  - **COMPROBANTE**: transfiere a \`validator\`.
  - **AYUDA**: responde tú mismo sin tools, de forma breve.

  ESTADO PERSISTENTE (session.state):
  - Puedes apoyarte en estos valores si existen: grupo seleccionado {user:selected_group_id?}, moneda preferida {user:preferred_currency?}, teléfono verificado {user:phone_verified?}.

  FORMATO DE RESPUESTA:
  - Responde en español.
  - Sé conciso pero amigable.
  - Si falta información, pregunta específicamente qué necesitas.`;

    this.orchestratorAgent = new LlmAgent({
      name: 'pasatanda_orchestrator',
      model,
      instruction: orchestratorInstruction,
      description:
        'Orquestador principal que enruta intenciones y delega a subagentes',
      subAgents: [
        this.gameMasterAgent.agent,
        this.treasurerAgent.agent,
        this.validatorAgent.agent,
      ],
      tools: [this.orchestratorTools.verifyPhoneCodeTool],
    });

    this.runner = new Runner({
      agent: this.orchestratorAgent,
      appName: this.appName,
      sessionService: this.sessionService,
    });
  }

  async route(context: RouterMessageContext): Promise<OrchestrationResult> {
    const userId = this.normalizePhone(context.senderId);
    const sessionId = `${this.appName}:${userId}`;

    let session = await this.sessionService.getSession({
      appName: this.appName,
      userId,
      sessionId,
    });

    if (!session) {
      try {
        session = await this.sessionService.createSession({
          appName: this.appName,
          userId,
          sessionId,
          state: {
            'user:phone': context.senderId,
            groupId: context.groupId,
          },
        });
      } catch (error) {
        this.logger.error(
          `Error creando sesión en orquestador: ${(error as Error).message}`,
        );
      }
    }

    try {
      const userMessage = {
        role: 'user' as const,
        parts: [{ text: this.buildPrompt(context) }],
      };

      let responseText = '';
      let agentUsed = 'orchestrator';

      for await (const event of this.runner.runAsync({
        userId,
        sessionId,
        newMessage: userMessage,
      })) {
        if (event.author && event.author !== 'user') {
          agentUsed = event.author;
        }

        if (isFinalResponse(event)) {
          responseText = stringifyContent(event);
        }
      }

      const intent = this.detectIntent(context.originalText, responseText);
      const updatedSession = await this.sessionService.getSession({
        appName: this.appName,
        userId,
        sessionId,
      });

      return {
        intent,
        responseText,
        agentUsed,
        sessionState: updatedSession?.state as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.error(`Error en orquestación: ${(error as Error).message}`);
      this.logger.error((error as Error).stack);

      return {
        intent: 'UNKNOWN',
        responseText:
          'Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo o escribe "ayuda" para ver las opciones disponibles.',
        agentUsed: 'orchestrator',
      };
    }
  }

  private buildPrompt(context: RouterMessageContext): string {
    const parts: string[] = [];
    parts.push(context.originalText);

    const contextParts: string[] = [];
    contextParts.push(`[Teléfono del usuario: ${context.senderId}]`);

    if (context.groupId) {
      contextParts.push(`[Grupo WhatsApp: ${context.groupId}]`);
    }

    if (context.senderName) {
      contextParts.push(`[Nombre WhatsApp: ${context.senderName}]`);
    }

    if (context.referredProduct) {
      contextParts.push(
        `[Producto referido: ${context.referredProduct.productRetailerId}]`,
      );
    }

    if (contextParts.length > 0) {
      parts.push(`\n---\nContexto:\n${contextParts.join('\n')}`);
    }

    return parts.join('\n');
  }

  private detectIntent(
    userMessage: string,
    agentResponse: string,
  ): PasatandaIntent {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = agentResponse.toLowerCase();

    if (/^invite_(accept|decline):/.test(lowerMessage)) {
      return 'CREATE_GROUP';
    }
    if (
      /^tanda:(configure|status|add_participant|start):\d+/.test(lowerMessage)
    ) {
      const match = lowerMessage.match(
        /^tanda:(configure|status|add_participant|start):/,
      );
      const kind = match?.[1];
      if (kind === 'configure') return 'CONFIGURE_TANDA';
      if (kind === 'status') return 'CHECK_STATUS';
      if (kind === 'add_participant') return 'ADD_PARTICIPANT';
      if (kind === 'start') return 'START_TANDA';
    }

    if (/~\*|otp|c[oó]digo|pin/.test(lowerMessage)) {
      return 'VERIFY_PHONE';
    }
    if (/crear|nueva tanda|iniciar grupo|armar/.test(lowerMessage)) {
      return 'CREATE_GROUP';
    }
    if (/agregar|invitar|añadir|incluir/.test(lowerMessage)) {
      return 'ADD_PARTICIPANT';
    }
    if (/configurar|cambiar|modificar/.test(lowerMessage)) {
      return 'CONFIGURE_TANDA';
    }
    if (/estado|cómo va|info|ver tanda|mi turno/.test(lowerMessage)) {
      return 'CHECK_STATUS';
    }
    if (/pagar|cuota|link.*pago|qr/.test(lowerMessage)) {
      return 'PAY_QUOTA';
    }
    if (/comprobante|voucher|recibo|pagué/.test(lowerMessage)) {
      return 'UPLOAD_PROOF';
    }
    if (/ayuda|cómo funciona|qué puedo/.test(lowerMessage)) {
      return 'GENERAL_HELP';
    }
    if (/iniciar.*tanda|desplegar|activar/.test(lowerMessage)) {
      return 'START_TANDA';
    }

    if (/grupo.*creado|tanda.*creada/.test(lowerResponse)) {
      return 'CREATE_GROUP';
    }
    if (
      /(tel[eé]fono).*(verificado|validado)|c[oó]digo.*(verificado|validado)/.test(
        lowerResponse,
      )
    ) {
      return 'VERIFY_PHONE';
    }
    if (/link.*pago|qr.*generado|payment/.test(lowerResponse)) {
      return 'PAY_QUOTA';
    }
    if (/verificado|comprobante/.test(lowerResponse)) {
      return 'UPLOAD_PROOF';
    }

    return 'UNKNOWN';
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }
}
