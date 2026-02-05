import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppMessagingService } from '../../whatsapp/services/whatsapp.messaging.service';

@Injectable()
export class GroupWorkflowService {
  private readonly logger = new Logger(GroupWorkflowService.name);

  constructor(private readonly messaging: WhatsAppMessagingService) {}

  async createDraftGroupForUser(params: {
    senderPhone: string;
    groupName?: string;
    amountUsd?: number;
    frequencyDays?: number;
    yieldEnabled?: boolean;
  }): Promise<void> {
    this.logger.debug(`Solicitud de creación de grupo desde ${params.senderPhone}`);
    await this.messaging.sendText(
      params.senderPhone,
      `Estamos preparando tu nueva tanda${params.groupName ? ` "${params.groupName}"` : ''}. Te avisaremos cuando esté lista para invitar participantes.`,
    );
  }

  async sendAdminSelectionPlaceholder(to: string, purpose?: string): Promise<void> {
    await this.messaging.sendText(
      to,
      `Necesito que selecciones una tanda para continuar${purpose ? ` (${purpose})` : ''}. Por ahora esta selección se completará de forma manual.`,
    );
  }

  async addParticipantPlaceholder(params: {
    senderPhone?: string;
    participantPhone?: string;
    participantName?: string;
  }): Promise<void> {
    const to = params.senderPhone ?? params.participantPhone ?? '';
    await this.messaging.sendText(
      to,
      'Registramos tu intención de agregar un participante. Te confirmaremos cuando esté agregado.',
    );
  }

  async respondInvitationPlaceholder(params: {
    senderPhone: string;
    inviteCode?: string;
    accept?: boolean;
  }): Promise<void> {
    await this.messaging.sendText(
      params.senderPhone,
      params.accept
        ? '¡Invitación aceptada! Te incorporaremos a la tanda en breve.'
        : 'Invitación rechazada. Si fue un error, vuelve a compartir el código.',
    );
  }

  async configureGroupPlaceholder(to: string): Promise<void> {
    await this.messaging.sendText(
      to,
      'Recibí tu solicitud de configuración. Ajustaremos los parámetros y te notificaremos.',
    );
  }

  async checkGroupStatusPlaceholder(to: string): Promise<void> {
    await this.messaging.sendText(
      to,
      'Enviaremos el estado actualizado de tu tanda pronto.',
    );
  }

  async startTandaPlaceholder(to: string): Promise<void> {
    await this.messaging.sendText(
      to,
      'Estamos iniciando tu tanda. Recibirás confirmación cuando quede activa.',
    );
  }

  async getUserInfoPlaceholder(to: string): Promise<void> {
    await this.messaging.sendText(
      to,
      'Consultaremos tu información y te la compartiremos en breve.',
    );
  }
}
