import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroupService } from './group.service';
import { WhatsAppMessagingService } from '../../whatsapp/services/whatsapp.messaging.service';
import type { GroupSummary, InviteInfo } from '../types/group-creation.types';
import type { WhatsAppInteractiveListSection } from '../../whatsapp/interfaces/whatsapp-messaging.interface';

@Injectable()
export class GroupMessagingService {
  private readonly logger = new Logger(GroupMessagingService.name);
  private readonly inviteStickerId?: string;
  private readonly successStickerId?: string;

  constructor(
    private readonly messaging: WhatsAppMessagingService,
    private readonly groups: GroupService,
    config: ConfigService,
  ) {
    this.inviteStickerId = config.get<string>('WHATSAPP_STICKER_INVITE');
    this.successStickerId = config.get<string>('WHATSAPP_STICKER_SUCCESS');
  }

  async createDraftGroupForUser(params: {
    senderPhone: string;
    groupName?: string;
    amountUsd?: number;
    frequencyDays?: number;
    yieldEnabled?: boolean;
  }): Promise<void> {
    this.logger.debug(
      `Solicitud de creación de grupo desde ${params.senderPhone}`,
    );

    const summaryParts = [
      params.groupName ? `Nombre: ${params.groupName}` : null,
      params.amountUsd ? `Aporte: $${params.amountUsd}` : null,
      params.frequencyDays
        ? `Frecuencia: cada ${params.frequencyDays} días`
        : null,
      params.yieldEnabled ? 'Con rendimientos habilitados' : null,
    ].filter(Boolean);

    await this.messaging.sendText(
      params.senderPhone,
      `Estamos preparando tu nueva tanda${params.groupName ? ` "${params.groupName}"` : ''}.
${summaryParts.length ? summaryParts.join(' | ') : 'Te avisaremos cuando esté lista para invitar participantes.'}`,
    );

    await this.sendStickerIfAvailable(params.senderPhone, this.inviteStickerId);
  }

  async sendAdminSelectionPrompt(params: {
    to: string;
    userId?: string;
    purpose?: string;
  }): Promise<void> {
    if (!params.userId) {
      await this.messaging.sendText(
        params.to,
        'Elige la tanda que quieres administrar. Aún no tengo tu usuario vinculado, así que esta selección será manual.',
      );
      return;
    }

    const groups = await this.groups.listGroupsForUser(params.userId);
    if (!groups.length) {
      await this.messaging.sendText(
        params.to,
        'No encontré tandas asociadas a tu usuario. Crea una y vuelve a intentarlo.',
      );
      return;
    }

    await this.messaging.sendInteractiveList(
      params.to,
      'Selecciona la tanda que quieres administrar',
      'Ver tandas',
      this.buildGroupSections(groups, params.purpose ?? 'select'),
      { footer: 'Responde para continuar con la acción solicitada' },
    );
  }

  async addParticipant(params: {
    senderPhone?: string;
    participantPhone?: string;
    participantName?: string;
    groupId?: string;
    userId?: string;
  }): Promise<void> {
    const to = params.senderPhone ?? params.participantPhone ?? '';

    if (params.groupId && params.userId) {
      try {
        const turnNumber = await this.groups.getNextTurnNumber(params.groupId);
        const membership = await this.groups.addMembership({
          groupId: params.groupId,
          userId: params.userId,
          turnNumber,
          isAdmin: false,
        });

        const effectiveTurn = membership.turnNumber ?? turnNumber;

        await this.messaging.sendText(
          to,
          params.participantName
            ? `Agregamos a ${params.participantName} a la tanda. Turno asignado: ${effectiveTurn}.`
            : `Participante agregado a la tanda. Turno asignado: ${effectiveTurn}.`,
        );
        return;
      } catch (error) {
        this.logger.warn(
          `No se pudo agregar participante al grupo ${params.groupId}: ${(error as Error).message}`,
        );
      }
    }

    await this.messaging.sendInteractiveButtons(
      to,
      params.participantName
        ? `¿Confirmas que quieres agregar a ${params.participantName}?`
        : '¿Confirmas que quieres agregar a este participante?',
      [
        {
          type: 'reply',
          reply: { id: 'participant:add:confirm', title: 'Confirmar' },
        },
        {
          type: 'reply',
          reply: { id: 'participant:add:cancel', title: 'Cancelar' },
        },
      ],
      {
        footer:
          'Comparte el código de invitación para asignar al participante en la tanda correcta.',
      },
    );
  }

  async sendInvitationLink(params: {
    groupId: string;
    to: string;
    adminUserId?: string;
  }): Promise<InviteInfo> {
    let invite: InviteInfo | null = null;
    try {
      invite = params.adminUserId
        ? await this.groups.regenerateInviteCode({
            groupId: params.groupId,
            adminUserId: params.adminUserId,
          })
        : await this.groups.getGroupMetadata(params.groupId);
    } catch (error) {
      this.logger.warn(
        `No se pudo generar la invitación para el grupo ${params.groupId}: ${(error as Error).message}`,
      );
      await this.messaging.sendText(
        params.to,
        'No pude generar el enlace de invitación. Verifica que el grupo exista y que seas administrador.',
      );
      throw error;
    }

    if (!invite) {
      await this.messaging.sendText(
        params.to,
        'No pude obtener el enlace de invitación. Verifica que la tanda exista o que seas administrador.',
      );
      throw new Error('No se pudo generar la invitación para la tanda');
    }

    await this.messaging.sendInteractiveCtaUrl(params.to, {
      bodyText: `Comparte este enlace para invitar a tu tanda "${invite.groupName}"`,
      buttonDisplayText: 'Unirme a la tanda',
      buttonUrl: invite.inviteLink,
      footerText: 'El enlace expira cuando generas uno nuevo',
    });

    await this.sendInvitationButtons(params.to, invite.inviteCode);
    await this.sendStickerIfAvailable(params.to, this.inviteStickerId);

    return invite;
  }

  async respondInvitation(params: {
    senderPhone: string;
    inviteCode?: string;
    accept?: boolean;
    userId?: string;
  }): Promise<void> {
    if (!params.inviteCode) {
      await this.messaging.sendText(
        params.senderPhone,
        'Necesito el código de invitación para procesar tu respuesta.',
      );
      return;
    }

    if (params.accept === false) {
      await this.messaging.sendText(
        params.senderPhone,
        'Invitación rechazada. Avísanos si necesitas otro enlace.',
      );
      return;
    }

    const group = await this.groups.getGroupByInviteCode(params.inviteCode);
    if (!group) {
      await this.messaging.sendText(
        params.senderPhone,
        'No encontré una tanda con ese código de invitación.',
      );
      return;
    }

    if (params.userId) {
      try {
        const joined = await this.groups.joinGroupByInviteCode({
          inviteCode: params.inviteCode,
          userId: params.userId,
        });

        await this.messaging.sendText(
          params.senderPhone,
          `Te unimos a "${group.name}". Tu turno asignado es ${joined.turnIndex}.`,
        );
        await this.sendStickerIfAvailable(
          params.senderPhone,
          this.successStickerId,
        );
        return;
      } catch (error) {
        this.logger.warn(
          `No se pudo unir al usuario con código ${params.inviteCode}: ${(error as Error).message}`,
        );
      }
    }

    await this.messaging.sendInteractiveButtons(
      params.senderPhone,
      'Confirma tu decisión sobre la invitación',
      [
        {
          type: 'reply',
          reply: {
            id: `invite_accept:${params.inviteCode}`,
            title: 'Aceptar',
          },
        },
        {
          type: 'reply',
          reply: {
            id: `invite_decline:${params.inviteCode}`,
            title: 'Rechazar',
          },
        },
      ],
    );
  }

  async configureGroup(params: {
    to: string;
    groupId?: string;
  }): Promise<void> {
    const metadata = params.groupId
      ? await this.groups.getGroupMetadata(params.groupId)
      : null;

    await this.messaging.sendText(
      params.to,
      metadata
        ? `Configuraremos la tanda "${metadata.groupName}" y te notificaremos los cambios.`
        : 'Recibí tu solicitud de configuración. Ajustaremos los parámetros y te notificaremos.',
    );
  }

  async checkGroupStatus(params: {
    to: string;
    groupId?: string;
    userId?: string;
  }): Promise<void> {
    if (params.groupId && params.userId) {
      try {
        const dashboard = await this.groups.getDashboard(
          params.groupId,
          params.userId,
        );

        await this.messaging.sendText(
          params.to,
          `Estado de la tanda: ${dashboard.group.status}. Participantes: ${dashboard.participants.length}. Tu estado: ${dashboard.myStatus}.`,
        );
        return;
      } catch (error) {
        this.logger.warn(
          `No se pudo consultar el estado del grupo ${params.groupId}: ${(error as Error).message}`,
        );
      }
    }

    await this.messaging.sendText(
      params.to,
      'Enviaremos el estado actualizado de tu tanda pronto.',
    );
  }

  async startTanda(params: {
    to: string;
    groupId?: string;
    adminUserId?: string;
  }): Promise<void> {
    if (params.groupId && params.adminUserId) {
      try {
        await this.groups.startGroup({
          groupId: params.groupId,
          adminUserId: params.adminUserId,
        });

        await this.messaging.sendText(
          params.to,
          'Iniciamos tu tanda. Todos los participantes serán notificados.',
        );
        await this.sendStickerIfAvailable(params.to, this.successStickerId);
        return;
      } catch (error) {
        this.logger.warn(
          `No se pudo iniciar la tanda ${params.groupId}: ${(error as Error).message}`,
        );
      }
    }

    await this.messaging.sendText(
      params.to,
      'Estamos iniciando tu tanda. Recibirás confirmación cuando quede activa.',
    );
  }

  private buildGroupSections(
    groups: GroupSummary[],
    purpose: string,
  ): WhatsAppInteractiveListSection[] {
    return [
      {
        title: 'Mis tandas',
        rows: groups.map((group) => ({
          id: `tanda:${purpose}:${group.id}`,
          title: group.name,
          description: `Aporte $${group.contributionAmount} · ${group.status}`,
        })),
      },
    ];
  }

  private async sendInvitationButtons(
    to: string,
    inviteCode: string,
  ): Promise<void> {
    await this.messaging.sendInteractiveButtons(
      to,
      'Comparte este enlace y permite responder invitaciones',
      [
        {
          type: 'reply',
          reply: { id: `invite_accept:${inviteCode}`, title: 'Aceptar' },
        },
        {
          type: 'reply',
          reply: { id: `invite_decline:${inviteCode}`, title: 'Rechazar' },
        },
      ],
    );
  }

  private async sendStickerIfAvailable(
    to: string,
    stickerId?: string,
  ): Promise<void> {
    if (!stickerId) return;
    try {
      await this.messaging.sendSticker(to, { id: stickerId });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el sticker configurado (${stickerId}): ${(error as Error).message}`,
      );
    }
  }
}
