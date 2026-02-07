import { Injectable } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { GroupMessagingService } from '../../../../features/groups/services/group-messaging.service';

@Injectable()
export class GameMasterToolsService {
  constructor(private readonly groups: GroupMessagingService) {}

  get createGroupTool(): FunctionTool {
    return new FunctionTool({
      name: 'create_pasatanda_group',
      description: 'Crea una tanda en borrador y notifica al usuario.',
      parameters: z.object({
        senderPhone: z.string(),
        groupName: z.string().optional(),
        amountUsd: z.number().optional(),
        frequencyDays: z.number().optional(),
        yieldEnabled: z.boolean().optional(),
      }),
      execute: async (args) => {
        await this.groups.createDraftGroupForUser(args);
        return { acknowledged: true };
      },
    });
  }

  get selectAdminGroupTool(): FunctionTool {
    return new FunctionTool({
      name: 'select_admin_group',
      description:
        'Envía un listado para que el usuario elija la tanda administrada.',
      parameters: z.object({
        senderPhone: z.string(),
        userId: z.string().optional(),
        purpose: z.string().optional(),
      }),
      execute: async (args) => {
        await this.groups.sendAdminSelectionPrompt({
          to: args.senderPhone,
          userId: args.userId,
          purpose: args.purpose,
        });
        return { acknowledged: true };
      },
    });
  }

  get addParticipantTool(): FunctionTool {
    return new FunctionTool({
      name: 'add_participant_to_group',
      description: 'Agrega un participante a la tanda y confirma al usuario.',
      parameters: z.object({
        senderPhone: z.string().optional(),
        participantPhone: z.string().optional(),
        participantName: z.string().optional(),
      }),
      execute: async (args) => {
        await this.groups.addParticipantPlaceholder(args);
        return { acknowledged: true };
      },
    });
  }

  get generateInvitationTool(): FunctionTool {
    return new FunctionTool({
      name: 'generate_group_invitation',
      description: 'Genera y comparte un enlace de invitación para una tanda.',
      parameters: z.object({
        senderPhone: z.string(),
        groupId: z.string(),
        adminUserId: z.string().optional(),
      }),
      execute: async (args) => {
        const invite = await this.groups.sendInvitationLink({
          groupId: args.groupId,
          to: args.senderPhone,
          adminUserId: args.adminUserId,
        });

        return { inviteCode: invite.inviteCode, inviteLink: invite.inviteLink };
      },
    });
  }

  get respondToInvitationTool(): FunctionTool {
    return new FunctionTool({
      name: 'respond_to_invitation',
      description: 'Acepta o rechaza una invitación usando un código.',
      parameters: z.object({
        senderPhone: z.string(),
        inviteCode: z.string().optional(),
        accept: z.boolean().optional(),
      }),
      execute: async (args) => {
        await this.groups.respondInvitationPlaceholder({
          senderPhone: args.senderPhone,
          inviteCode: args.inviteCode,
          accept: args.accept ?? true,
        });
        return { acknowledged: true };
      },
    });
  }

  get configureGroupTool(): FunctionTool {
    return new FunctionTool({
      name: 'configure_tanda',
      description: 'Configura parámetros de la tanda seleccionada.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.groups.configureGroupPlaceholder(args.senderPhone);
        return { acknowledged: true };
      },
    });
  }

  get checkGroupStatusTool(): FunctionTool {
    return new FunctionTool({
      name: 'check_group_status',
      description: 'Consulta el estado de la tanda y responde al usuario.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.groups.checkGroupStatusPlaceholder(args.senderPhone);
        return { acknowledged: true };
      },
    });
  }

  get startTandaTool(): FunctionTool {
    return new FunctionTool({
      name: 'start_tanda',
      description: 'Inicia la tanda seleccionada y confirma.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.groups.startTandaPlaceholder(args.senderPhone);
        return { acknowledged: true };
      },
    });
  }

  get getUserInfoTool(): FunctionTool {
    return new FunctionTool({
      name: 'get_user_info',
      description: 'Recupera la información del usuario en la tanda.',
      parameters: z.object({ senderPhone: z.string() }),
      execute: async (args) => {
        await this.groups.getUserInfoPlaceholder(args.senderPhone);
        return { acknowledged: true };
      },
    });
  }

  get allTools(): FunctionTool[] {
    return [
      this.createGroupTool,
      this.selectAdminGroupTool,
      this.generateInvitationTool,
      this.addParticipantTool,
      this.respondToInvitationTool,
      this.configureGroupTool,
      this.checkGroupStatusTool,
      this.startTandaTool,
      this.getUserInfoTool,
    ];
  }
}
