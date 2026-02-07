import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../../common/intraestructure/supabase/supabase.service';
import type {
  AddMembershipParams,
  CreateGroupParams,
  CreateGroupResult,
  GroupDashboard,
  GroupSummary,
  InviteInfo,
} from '../types/group-creation.types';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);
  private readonly inviteBaseUrl: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.inviteBaseUrl = this.config.get<string>(
      'INVITE_BASE_URL',
      'https://pasatanda.lat/join',
    );
  }

  async createGroup(params: CreateGroupParams): Promise<CreateGroupResult> {
    this.ensureSupabaseReady();
    const inviteCode = this.generateInviteCode();

    const rows = await this.supabase.query<{ id: string; invite_code: string }>(
      `insert into groups (name, contribution_amount_usdc, guarantee_amount_usdc, frequency, total_rounds, status, invite_code, created_by)
       values ($1, $2, $3, $4, $5, 'DRAFT', $6, $7)
       returning id, invite_code`,
      [
        params.name,
        params.contributionAmount,
        params.guaranteeAmount,
        params.frequency,
        params.totalRounds,
        inviteCode,
        params.createdBy,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error('No se pudo crear el grupo');
    }

    return { id: row.id, inviteCode: row.invite_code };
  }

  async regenerateInviteCode(params: {
    groupId: string;
    adminUserId: string;
  }): Promise<InviteInfo> {
    this.ensureSupabaseReady();

    const membership = await this.supabase.query<{ is_admin: boolean }>(
      'select is_admin from memberships where group_id = $1 and user_id = $2 limit 1',
      [params.groupId, params.adminUserId],
    );

    const isAdmin = membership[0]?.is_admin;
    if (!isAdmin) {
      throw new UnauthorizedException(
        'Solo un administrador puede generar invitaciones.',
      );
    }

    const inviteCode = this.generateInviteCode();
    const rows = await this.supabase.query<{
      invite_code: string;
      name: string;
    }>(
      'update groups set invite_code = $1 where id = $2 returning invite_code, name',
      [inviteCode, params.groupId],
    );

    const row = rows[0];
    if (!row) {
      throw new Error('No se pudo regenerar el código de invitación');
    }

    const inviteLink = this.buildInviteLink(row.invite_code);
    return {
      inviteCode: row.invite_code,
      inviteLink,
      groupName: row.name ?? 'tu tanda',
    };
  }

  async addMembership(params: AddMembershipParams): Promise<string> {
    this.ensureSupabaseReady();

    await this.supabase.query(
      `insert into memberships (group_id, user_id, turn_number, is_admin)
       values ($1, $2, $3, $4)
       on conflict (group_id, user_id) do nothing`,
      [
        params.groupId,
        params.userId,
        params.turnNumber ?? null,
        params.isAdmin ?? false,
      ],
    );

    const rows = await this.supabase.query<{
      id: string;
      turn_number: number | null;
    }>(
      'select id, turn_number from memberships where group_id = $1 and user_id = $2 limit 1',
      [params.groupId, params.userId],
    );

    const row = rows[0];
    if (!row) {
      throw new Error('No se pudo registrar la membresía');
    }

    return row.id;
  }

  async listGroupsForUser(userId: string): Promise<GroupSummary[]> {
    this.ensureSupabaseReady();
    const rows = await this.supabase.query<{
      id: string;
      name: string;
      status: string;
      contribution_amount_usdc: string;
      turn_number: number | null;
    }>(
      `select g.id, g.name, g.status, g.contribution_amount_usdc, m.turn_number
       from groups g
       inner join memberships m on m.group_id = g.id
       where m.user_id = $1
       order by g.created_at desc`,
      [userId],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      contributionAmount: Number(row.contribution_amount_usdc),
      myTurn: row.turn_number ?? null,
    }));
  }

  async getNextTurnNumber(groupId: string): Promise<number> {
    this.ensureSupabaseReady();
    const rows = await this.supabase.query<{ max: number | null }>(
      'select max(turn_number) as max from memberships where group_id = $1',
      [groupId],
    );

    const currentMax = rows[0]?.max ?? 0;
    return (currentMax ?? 0) + 1;
  }

  async getGroupMetadata(groupId: string): Promise<InviteInfo | null> {
    this.ensureSupabaseReady();
    const rows = await this.supabase.query<{
      name: string;
      invite_code: string;
    }>('select name, invite_code from groups where id = $1 limit 1', [groupId]);

    const row = rows[0];
    if (!row) return null;

    return {
      groupName: row.name,
      inviteCode: row.invite_code,
      inviteLink: this.buildInviteLink(row.invite_code),
    };
  }

  getInviteLink(inviteCode: string): string {
    return this.buildInviteLink(inviteCode);
  }

  async getDashboard(groupId: string, userId: string): Promise<GroupDashboard> {
    this.ensureSupabaseReady();

    const groupRows = await this.supabase.query<{
      object_id: string | null;
      status: string;
    }>('select object_id, status from groups where id = $1 limit 1', [groupId]);

    const group = groupRows[0] ?? { object_id: null, status: 'DRAFT' };

    const participantRows = await this.supabase.query<{
      alias: string | null;
      user_id: string;
    }>(
      `select u.alias, m.user_id
       from memberships m
       inner join users u on u.id = m.user_id
       where m.group_id = $1
       order by m.turn_number nulls last`,
      [groupId],
    );

    const participants = participantRows.map((row) => ({
      alias: row.alias,
      status: 'ACTIVE',
    }));

    const isMember = participantRows.some((row) => row.user_id === userId);

    return {
      group: { objectId: group.object_id, status: group.status },
      participants,
      myStatus: isMember ? 'PENDING_PAYMENT' : 'NOT_MEMBER',
    };
  }

  private ensureSupabaseReady(): void {
    if (!this.supabase.isEnabled()) {
      this.logger.error('SupabaseService no está configurado.');
      throw new Error(
        'Servicio de grupos deshabilitado por falta de conexión a Supabase',
      );
    }
  }

  private buildInviteLink(inviteCode: string): string {
    const base = this.inviteBaseUrl.endsWith('/')
      ? this.inviteBaseUrl.slice(0, -1)
      : this.inviteBaseUrl;
    return `${base}/${inviteCode}`;
  }

  private generateInviteCode(): string {
    return randomBytes(5).toString('hex');
  }
}
