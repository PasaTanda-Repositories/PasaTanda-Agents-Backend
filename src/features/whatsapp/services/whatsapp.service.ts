import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WhatsAppMessage,
  WhatsAppIncomingMessage,
  WhatsAppStatus,
  WhatsAppContact,
} from '../interfaces/whatsapp.interface';
import { MessageContextOptions as MessagingContext } from '../interfaces/whatsapp-messaging.interface';
import { AdkOrchestratorService } from '../../../core/adk/orchestrator/adk-orchestrator.service';
import { WhatsAppMessagingService } from './whatsapp.messaging.service';
import { VerificationService } from '../../login/verification.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly defaultPhoneNumberId: string;
  private readonly sendAgentText: boolean;
  // Cache in-memory para evitar reprocesar mensajes cuando Meta reintenta el webhook.
  private readonly processedMessageCache = new Map<string, number>();
  private readonly processedMessageTtlMs = 10 * 60 * 1000; // 10 minutos

  constructor(
    private readonly configService: ConfigService,
    private readonly adkOrchestrator: AdkOrchestratorService,
    private readonly messagingService: WhatsAppMessagingService,
    private readonly verification: VerificationService,
  ) {
    this.defaultPhoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID', '') ||
      this.configService.get<string>('PHONE_NUMBER_ID', '');
    this.sendAgentText =
      this.configService.get<string>('ADK_SEND_AGENT_TEXT', 'false') === 'true';
    this.logger.log('🤖 Orquestador ADK activado');
  }

  /**
   * Verifica el webhook de WhatsApp
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
      '',
    );

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verificado correctamente');
      return challenge;
    }

    this.logger.error('Verificación de webhook fallida');
    return null;
  }

  /**
   * Procesa los mensajes entrantes de WhatsApp
   */
  async processIncomingMessage(body: WhatsAppMessage): Promise<void> {
    try {
      // Log del payload completo para debugging
      this.logger.debug('Payload recibido:', JSON.stringify(body, null, 2));

      // Verificar que el objeto sea de WhatsApp
      if (body.object !== 'whatsapp_business_account') {
        this.logger.warn('Objeto no es de WhatsApp Business Account');
        return;
      }

      // Procesar cada entrada
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          const phoneNumberId =
            value.metadata?.phone_number_id ?? this.defaultPhoneNumberId;

          // Procesar mensajes
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const contactWaId = this.resolveContactWaId(
                value.contacts,
                message.from,
              );
              const contactName = this.resolveContactName(
                value.contacts,
                message.from,
              );
              await this.handleMessage(
                message,
                phoneNumberId,
                contactWaId,
                contactName,
              );
            }
          }

          // Procesar estados de mensajes (enviado, entregado, leído, etc.)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              this.handleMessageStatus(status);
            }
          }
        }
      }
    } catch (error) {
      const safeError = error as Error & { response?: { data?: unknown } };
      const details = safeError.response?.data ?? safeError.message;
      this.logger.error('Error procesando mensaje entrante:', details);
      this.logger.error('Stack trace:', safeError.stack);
      this.logger.error('Payload completo:', JSON.stringify(body, null, 2));
      throw safeError;
    }
  }

  /**
   * Maneja un mensaje individual
   */
  private async handleMessage(
    message: WhatsAppIncomingMessage,
    phoneNumberId: string,
    contactWaId?: string,
    contactName?: string,
  ): Promise<void> {
    if (this.isDuplicateMessage(message.id)) {
      this.logger.warn(
        `Mensaje duplicado detectado (id=${message.id}). Se omite para evitar reprocesamiento.`,
      );
      return;
    }

    this.logger.log(`Mensaje recibido de: ${message.from}`);
    this.logger.log(`Tipo de mensaje: ${message.type}`);

    // Log de información adicional si está disponible
    if (message.context) {
      this.logger.log(
        `Mensaje con contexto - Origen: ${message.context.from}, ID: ${message.context.id}`,
      );
      if (message.context.referred_product) {
        this.logger.log(
          `Producto referenciado - Catálogo: ${message.context.referred_product.catalog_id}, Producto: ${message.context.referred_product.product_retailer_id}`,
        );
      }
    }

    if (message.referral) {
      this.logger.log(
        `Mensaje desde anuncio - Tipo: ${message.referral.source_type}, URL: ${message.referral.source_url}`,
      );
      this.logger.log(`Headline: ${message.referral.headline}`);
      this.logger.log(`Body: ${message.referral.body}`);
      if (message.referral.ctwa_clid) {
        this.logger.log(`CTWA Click ID: ${message.referral.ctwa_clid}`);
      }
    }

    // Marcar el mensaje como leído. Para texto/interactivos también mostramos indicador de escritura.
    await this.messagingService.markAsRead(message.id, {
      phoneNumberId,
      showTypingIndicator:
        message.type === 'text' || message.type === 'interactive',
    });

    switch (message.type) {
      case 'text':
        if (message.text) {
          this.logger.log(`Texto: ${message.text.body}`);
          await this.handleTextMessage(
            message,
            phoneNumberId,
            contactWaId,
            contactName,
          );
        }
        break;

      case 'image':
        this.logger.log('Imagen recibida:', message.image);
        await this.handleMediaMessage(message, 'image', phoneNumberId);
        break;

      case 'video':
        this.logger.log('Video recibido:', message.video);
        await this.handleMediaMessage(message, 'video', phoneNumberId);
        break;

      case 'audio':
        this.logger.log('Audio recibido:', message.audio);
        await this.handleMediaMessage(message, 'audio', phoneNumberId);
        break;

      case 'document':
        this.logger.log('Documento recibido:', message.document);
        await this.handleMediaMessage(message, 'document', phoneNumberId);
        break;

      case 'location':
        this.logger.log('Ubicación recibida:', message.location);
        await this.handleLocationMessage(message, phoneNumberId);
        break;

      case 'interactive':
        this.logger.log('Interacción recibida:', message.interactive);
        await this.handleInteractiveMessage(message, phoneNumberId);
        break;

      case 'button':
        this.logger.log('Botón presionado');
        await this.handleButtonMessage(message, phoneNumberId);
        break;

      case 'reaction':
        this.logger.log('Reacción recibida');
        break;

      case 'sticker':
        this.logger.log('Sticker recibido');
        break;

      case 'order':
        this.logger.log('Orden recibida');
        break;

      case 'system':
        this.logger.log('Mensaje de sistema recibido');
        break;

      case 'unsupported':
        this.logger.warn('Tipo de mensaje no soportado');
        if (message.errors && message.errors.length > 0) {
          message.errors.forEach((error) => {
            this.logger.error(
              `Error ${error.code}: ${error.title} - ${error.message || 'Sin detalles'}`,
            );
          });
        }
        break;

      default:
        this.logger.warn(`Tipo de mensaje no manejado: ${message.type}`);
    }
  }

  /**
   * Maneja mensajes de texto con lógica de respuesta automática
   */
  private async handleTextMessage(
    message: WhatsAppIncomingMessage,
    phoneNumberId: string,
    contactWaId?: string,
    contactName?: string,
  ): Promise<void> {
    if (!message.text) return;

    const canonicalSender = contactWaId ?? message.from;
    this.logger.log(`📨 Procesando mensaje de ${canonicalSender}`);

    const verifiedViaOtp = await this.verification.verifyFromMessage(
      canonicalSender,
      message.text.body,
    );

    if (verifiedViaOtp) {
      await this.verification.markPhoneVerified(canonicalSender);
      await this.messagingService.sendText(
        canonicalSender,
        '✅ Número verificado. Ya puedes continuar en la app.',
        { phoneNumberId },
      );
      return;
    }

    await this.handleWithAdkOrchestrator(
      canonicalSender,
      message,
      phoneNumberId,
      contactName,
    );
  }

  /**
   * Procesa mensaje usando el orquestador ADK (Google Agent Development Kit)
   */
  private async handleWithAdkOrchestrator(
    canonicalSender: string,
    message: WhatsAppIncomingMessage,
    phoneNumberId: string,
    contactName?: string,
  ): Promise<void> {
    this.logger.debug(
      `🤖 Procesando con ADK orchestrator para ${canonicalSender}`,
    );

    try {
      const result = await this.adkOrchestrator.route({
        senderId: canonicalSender,
        senderName: contactName,
        whatsappMessageId: message.id,
        originalText: message.text?.body ?? '',
        message,
        phoneNumberId,
        groupId: message.group?.id,
      });

      if (this.sendAgentText && result.responseText?.trim()) {
        await this.messagingService.sendText(
          canonicalSender,
          result.responseText,
          { phoneNumberId },
        );
      }

      this.logger.log(
        `✅ [ADK] Mensaje procesado para ${canonicalSender} - Intent: ${result.intent}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error en ADK orchestrator:`, error);
      // Fallback a mensaje de error amigable
      await this.messagingService.sendText(
        canonicalSender,
        'Lo siento, tuve un problema procesando tu mensaje. Por favor intenta de nuevo.',
        { phoneNumberId },
      );
    }
  }

  /**
   * Maneja mensajes con medios (imagen, video, audio, documento)
   */
  private async handleMediaMessage(
    message: WhatsAppIncomingMessage,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    phoneNumberId: string,
  ): Promise<void> {
    const media = message[mediaType];
    if (!media) return;

    this.logger.log(
      `${mediaType} recibido - ID: ${media.id}, MIME: ${media.mime_type}`,
    );

    // Aquí puedes implementar lógica para descargar y procesar el medio
    // Por ejemplo: const mediaBuffer = await this.messagingService.downloadMedia(media.id);

    await this.messagingService.sendText(
      message.from,
      `Recibí tu ${mediaType === 'image' ? 'imagen' : mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'documento'}. Para continuar necesito una instrucción en texto (ej. "Pagar 1250" o "Agendar cita").`,
      { phoneNumberId },
    );
  }

  /**
   * Maneja mensajes de ubicación
   */
  private async handleLocationMessage(
    message: WhatsAppIncomingMessage,
    phoneNumberId: string,
  ): Promise<void> {
    if (!message.location) return;

    this.logger.log(
      `Ubicación recibida - Lat: ${message.location.latitude}, Lng: ${message.location.longitude}`,
    );

    if (message.location.name) {
      this.logger.log(`Nombre del lugar: ${message.location.name}`);
    }

    await this.messagingService.sendText(
      message.from,
      'Ubicación recibida. Confírmame en texto cómo deseas usarla y la enrutamos al agente correspondiente.',
      { phoneNumberId },
    );
  }

  /**
   * Maneja mensajes interactivos (botones, listas)
   */
  private async handleInteractiveMessage(
    message: WhatsAppIncomingMessage,
    phoneNumberId: string,
  ): Promise<void> {
    if (!message.interactive) return;

    if (message.interactive.button_reply) {
      this.logger.log(
        `Botón seleccionado - ID: ${message.interactive.button_reply.id}, Título: ${message.interactive.button_reply.title}`,
      );

      const selectionText =
        message.interactive.button_reply.id ||
        message.interactive.button_reply.title;
      await this.handleWithAdkOrchestrator(
        message.from,
        {
          ...(message as any),
          type: 'text',
          text: { body: selectionText },
        } as WhatsAppIncomingMessage,
        phoneNumberId,
      );
    } else if (message.interactive.list_reply) {
      this.logger.log(
        `Opción de lista seleccionada - ID: ${message.interactive.list_reply.id}, Título: ${message.interactive.list_reply.title}`,
      );

      const selectionText =
        message.interactive.list_reply.id ||
        message.interactive.list_reply.title;
      await this.handleWithAdkOrchestrator(
        message.from,
        {
          ...(message as any),
          type: 'text',
          text: { body: selectionText },
        } as WhatsAppIncomingMessage,
        phoneNumberId,
      );
    }
  }

  /**
   * Maneja mensajes de botón (tipo button)
   */
  private async handleButtonMessage(
    message: WhatsAppIncomingMessage,
    phoneNumberId: string,
  ): Promise<void> {
    this.logger.log('Botón presionado en el mensaje');
    // La lógica específica depende del tipo de botón
    // Este caso es similar a interactive pero para el tipo 'button'
    await this.messagingService.sendText(
      message.from,
      'Recibí tu selección. Envíame la instrucción en texto para activarla en el orquestador.',
      { phoneNumberId },
    );
  }

  /**
   * Maneja los estados de los mensajes
   */
  private handleMessageStatus(status: WhatsAppStatus): void {
    this.logger.log(
      `Estado del mensaje ${status.id}: ${status.status} - Destinatario: ${status.recipient_id}`,
    );
  }

  private isDuplicateMessage(messageId: string | undefined): boolean {
    if (!messageId) {
      return false;
    }

    const now = Date.now();
    this.pruneProcessedMessages(now);

    if (this.processedMessageCache.has(messageId)) {
      return true;
    }

    this.processedMessageCache.set(messageId, now);
    return false;
  }

  private pruneProcessedMessages(reference: number): void {
    for (const [id, timestamp] of this.processedMessageCache.entries()) {
      if (reference - timestamp > this.processedMessageTtlMs) {
        this.processedMessageCache.delete(id);
      }
    }
  }

  private resolveContactWaId(
    contacts: WhatsAppContact[] | undefined,
    messageFrom: string,
  ): string | undefined {
    if (!contacts?.length) {
      return undefined;
    }

    const match = contacts.find((contact) => contact.wa_id === messageFrom);
    return match?.wa_id ?? contacts[0]?.wa_id;
  }

  private resolveContactName(
    contacts: WhatsAppContact[] | undefined,
    messageFrom: string,
  ): string | undefined {
    if (!contacts?.length) {
      return undefined;
    }

    const match = contacts.find((contact) => contact.wa_id === messageFrom);
    const target = match ?? contacts[0];
    return target?.profile?.name;
  }
}
