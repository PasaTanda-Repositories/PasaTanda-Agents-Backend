import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../../common/intraestructure/supabase/supabase.service';
import type {
  UpsertUserParams,
  UpsertUserResult,
  CreateMembershipParams,
  CreateDraftGroupParams,
  CreateDraftGroupResult,
} from '../types/group-creation.types';

@Injectable()
export class GroupCreationService {
  private readonly logger = new Logger(GroupCreationService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async upsertUser(params: UpsertUserParams): Promise<UpsertUserResult> {
    this.ensureSupabaseReady();
    const normalizedPhone = this.normalizePhone(params.phone);

    const rows = await this.supabase.query<{ id: number }>(
      `
        INSERT INTO users (phone_number, username, stellar_public_key, wallet_secret_enc, preferred_currency, wallet_type)
        VALUES ($1, $2, $3, $4, $5, 'MANAGED')
        ON CONFLICT (phone_number)
        DO UPDATE SET
          username = EXCLUDED.username,
          stellar_public_key = EXCLUDED.stellar_public_key,
          wallet_secret_enc = EXCLUDED.wallet_secret_enc,
          preferred_currency = EXCLUDED.preferred_currency
        RETURNING id
      `,
      [
        normalizedPhone,
        params.username,
        stellarPublicKey,
        stellarSecretKey,
        params.preferredCurrency,
      ],
    );

    const userId = rows[0]?.id;
    if (!userId) {
      throw new Error('No se pudo crear o actualizar el usuario');
    }

    return { userId, stellarPublicKey, stellarSecretKey, normalizedPhone };
  }

  async createMembership(params: CreateMembershipParams): Promise<void> {
    this.ensureSupabaseReady();
    await this.supabase.query(
      `
        INSERT INTO memberships (user_id, group_id, is_admin, turn_number)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, group_id)
        DO NOTHING
      `,
      [params.userId, params.groupDbId, params.isAdmin, params.turnNumber ?? 1],
    );
  }

  async createDraftGroup(
    params: CreateDraftGroupParams,
  ): Promise<CreateDraftGroupResult> {
    this.ensureSupabaseReady();
    const groupId = randomUUID();
    const whatsappGroupJid = params.whatsappGroupId ?? `group-${groupId}@g.us`;
    const shareYieldInfo = params.yieldEnabled;

    const groupRows = await this.supabase.query<{ id: number }>(
      `
        INSERT INTO groups (group_whatsapp_id, name, total_cycle_amount_usdc, frequency_days, yield_enabled, status)
        VALUES ($1, $2, $3, $4, $5, 'DRAFT')
        RETURNING id
      `,
      [
        whatsappGroupJid,
        params.name,
        params.amount,
        params.frequencyDays,
        shareYieldInfo,
      ],
    );

    const groupDbId = groupRows[0]?.id;
    if (!groupDbId) {
      throw new Error('No se pudo crear el grupo');
    }

    return {
      groupId,
      groupDbId,
      whatsappGroupJid,
      enableYield: shareYieldInfo,
    };
  }

  private ensureSupabaseReady(): void {
    if (!this.supabase.isEnabled()) {
      this.logger.error(
        'SupabaseService no está configurado. Asegúrate de definir SUPABASE_DB_URL o POSTGRES_URL* para habilitar operaciones de grupos.',
      );
      throw new Error(
        'Servicio de grupos deshabilitado por falta de conexión a Supabase',
      );
    }
  }

  private normalizePhone(phone: string): string {
    const digitsOnly = phone?.replace(/\D/g, '') ?? '';
    if (!digitsOnly) {
      throw new Error('Número de teléfono inválido');
    }
    return digitsOnly;
  }
}

