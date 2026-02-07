import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../../common/intraestructure/supabase/supabase.service';
import type {
  AddMembershipParams,
  CreateGroupParams,
  CreateGroupResult,
  GroupDashboard,
  GroupSummary,
  FrequencyType,
} from '../types/group-creation.types';

@Injectable()
export class GroupCreationService {
  private readonly logger = new Logger(GroupCreationService.name);

  constructor(private readonly supabase: SupabaseService) {}

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

  async getDashboard(groupId: string, userId: string): Promise<GroupDashboard> {
    this.ensureSupabaseReady();

    const groupRows = await this.supabase.query<{
      id: string;
      name: string;
      status: string;
      object_id: string | null;
      contribution_amount_usdc: string | null;
      guarantee_amount_usdc: string | null;
      frequency: string | null;
      total_rounds: number | null;
      invite_code: string | null;
      created_by: string | null;
    }>(
      `select id, name, status, object_id, contribution_amount_usdc, guarantee_amount_usdc,
              frequency, total_rounds, invite_code, created_by
       from groups
       where id = $1
       limit 1`,
      [groupId],
    );

    const row = groupRows[0];
    const group = {
      id: row?.id ?? groupId,
      name: row?.name ?? null,
      status: row?.status ?? 'DRAFT',
      objectId: row?.object_id ?? null,
      contributionAmount: row?.contribution_amount_usdc
        ? Number(row.contribution_amount_usdc)
        : null,
      guaranteeAmount: row?.guarantee_amount_usdc
        ? Number(row.guarantee_amount_usdc)
        : null,
      frequency: (row?.frequency as FrequencyType) ?? null,
      totalRounds: row?.total_rounds ?? null,
      inviteCode: row?.invite_code ?? null,
      createdBy: row?.created_by ?? null,
    };

    const participantRows = await this.supabase.query<{
      membership_id: string;
      user_id: string;
      alias: string | null;
      is_admin: boolean | null;
      turn_number: number | null;
      joined_at: string | null;
    }>(
      `select m.id as membership_id, m.user_id, m.is_admin, m.turn_number, u.created_at as joined_at, u.alias
       from memberships m
       left join users u on u.id = m.user_id
       where m.group_id = $1
       order by m.turn_number nulls last, m.id asc`,
      [groupId],
    );

    const participants = participantRows.map((row) => ({
      membershipId: row.membership_id,
      userId: row.user_id,
      alias: row.alias ?? null,
      isAdmin: Boolean(row.is_admin),
      turnNumber: row.turn_number,
      joinedAt: row.joined_at ?? null,
    }));

    const transactionRows = await this.supabase.query<{
      id: string;
      user_id: string;
      type: string;
      method: string;
      status: string;
      amount_usdc: string | null;
      external_payment_url: string | null;
      qr_image_link: string | null;
      created_at: string | null;
    }>(
      `select id, user_id, type, method, status, amount_usdc, external_payment_url, qr_image_link, created_at
       from transactions
       where group_id = $1
       order by created_at desc nulls last`,
      [groupId],
    );

    const transactions = transactionRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      method: row.method,
      status: row.status,
      amount: row.amount_usdc ? Number(row.amount_usdc) : null,
      currency: 'USDC' as const,
      externalPaymentUrl: row.external_payment_url ?? null,
      qrImageLink: row.qr_image_link ?? null,
      createdAt: row.created_at ?? null,
    }));

    const isMember = participantRows.some((row) => row.user_id === userId);

    return {
      group,
      participants,
      transactions,
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

  private generateInviteCode(): string {
    return randomBytes(5).toString('hex');
  }
}
