import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/intraestructure/supabase/supabase.service';
import { FrontendWebhookService } from './frontend-webhook.service';
import type {
  ConfirmVerificationInput,
  DbVerificationRow,
  IssueCodeResult,
  VerificationConfirmationPayload,
  VerificationRecord,
} from './types/verification.types';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly ttlMs = 10 * 60 * 1000;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly frontendWebhook: FrontendWebhookService,
  ) {}

  async issueCode(phone: string): Promise<IssueCodeResult> {
    this.ensureSupabaseReady();
    const normalizedPhone = this.normalizePhone(phone);
    const code = this.generateCode();
    const expiresAt = Date.now() + this.ttlMs;
    const expiresAtDate = new Date(expiresAt);

    await this.supabase.query(
      `
        insert into verification_codes (phone, code, expires_at, verified, verified_at, whatsapp_username, whatsapp_number)
        values ($1, $2, $3, false, null, null, null)
        on conflict (phone)
        do update set
          code = excluded.code,
          expires_at = excluded.expires_at,
          verified = false,
          verified_at = null,
          whatsapp_username = null,
          whatsapp_number = null
      `,
      [normalizedPhone, code, expiresAtDate],
    );

    return { code, expiresAt: expiresAtDate };
  }

  async confirmCode(
    phone: string,
    code: string,
    whatsappUsername?: string,
  ): Promise<boolean> {
    if (!phone || !code) return false;

    const success = await this.verifyCode(phone, code);
    if (!success) {
      this.logger.debug(`Código OTP inválido para ${phone}`);
      return false;
    }

    const timestamp = Date.now();
    const confirmation: VerificationConfirmationPayload = {
      phone,
      verified: true,
      timestamp,
      whatsappUsername,
      whatsappNumber: phone,
    };

    await this.confirmVerification({
      phone,
      verified: true,
      timestamp,
      whatsappUsername,
      whatsappNumber: phone,
    });

    await this.frontendWebhook.sendVerificationConfirmation(confirmation);
    return true;
  }

  async isVerified(phone: string): Promise<boolean> {
    if (!phone) return false;
    const status = await this.getVerificationStatus(phone);
    return Boolean(status.verified);
  }

  async tryConfirmFromMessage(
    phone: string,
    text: string,
    whatsappUsername?: string,
  ): Promise<boolean> {
    if (!text) return false;

    const code = this.extractCodeFromMessage(text);
    if (!code) {
      this.logger.debug(
        'No se encontró un código delimitado por ~* en el mensaje entrante.',
      );
      return false;
    }

    const onboardingRecord = await this.getLatestRecord(phone);
    const expectedCode = onboardingRecord?.code ?? 'N/A';
    this.logger.debug(
      `Verificación: código extraído ${code}, código esperado ${expectedCode} (telefono: ${phone})`,
    );

    const verified = await this.confirmCode(phone, code, whatsappUsername);

    if (verified) {
      await this.frontendWebhook.sendVerificationConfirmation({
        phone,
        verified: true,
        timestamp: Date.now(),
        whatsappUsername,
        whatsappNumber: phone,
      });
    }

    return verified;
  }

  async confirmVerification(
    params: ConfirmVerificationInput,
  ): Promise<VerificationRecord> {
    this.ensureSupabaseReady();
    const normalizedPhone = this.normalizePhone(params.phone);
    const verifiedAtDate = params.verified
      ? new Date(params.timestamp ?? Date.now())
      : null;

    const rows = await this.supabase.query<DbVerificationRow>(
      `
        insert into verification_codes (phone, code, expires_at, verified, verified_at, whatsapp_username, whatsapp_number)
        values ($1, null, timezone('utc', now()) + interval '10 minutes', $2, $3, $4, $5)
        on conflict (phone)
        do update set
          verified = excluded.verified,
          verified_at = excluded.verified_at,
          whatsapp_username = excluded.whatsapp_username,
          whatsapp_number = excluded.whatsapp_number,
          code = case when excluded.verified then null else verification_codes.code end,
          expires_at = case when excluded.verified then excluded.verified_at else verification_codes.expires_at end
        returning *
      `,
      [
        normalizedPhone,
        params.verified,
        verifiedAtDate,
        params.whatsappUsername ?? null,
        params.whatsappNumber ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error(
        `No se pudo confirmar la verificación para ${params.phone}`,
      );
    }

    return this.mapRowToRecord(row);
  }

  async getLatestRecord(phone: string): Promise<VerificationRecord | undefined> {
    this.ensureSupabaseReady();
    const normalizedPhone = this.normalizePhone(phone);
    const row = await this.getRowByPhone(normalizedPhone);
    return row ? this.mapRowToRecord(row) : undefined;
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    this.ensureSupabaseReady();
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedCode = code.trim();
    if (!normalizedCode) return false;

    const row = await this.getRowByPhone(normalizedPhone);
    if (!row || !row.code) {
      return false;
    }

    const expiresAt = this.parseTimestamp(row.expires_at);
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      await this.deleteRow(row.id);
      return false;
    }

    if (row.code.trim().toUpperCase() !== normalizedCode.toUpperCase()) {
      return false;
    }

    await this.supabase.query(
      `
        update verification_codes
        set verified = true,
            verified_at = timezone('utc', now()),
            code = null,
            expires_at = timezone('utc', now())
        where id = $1
      `,
      [row.id],
    );

    return true;
  }

  async getVerificationStatus(phone: string): Promise<VerificationRecord> {
    this.ensureSupabaseReady();
    const normalizedPhone = this.normalizePhone(phone);
    const row = await this.getRowByPhone(normalizedPhone);

    if (!row) {
      return {
        phone: normalizedPhone,
        code: null,
        expiresAt: new Date(),
        verified: false,
        timestamp: null,
        whatsappUsername: undefined,
        whatsappNumber: undefined,
      };
    }

    return this.mapRowToRecord(row);
  }

  private async getRowByPhone(
    phone: string,
  ): Promise<DbVerificationRow | null> {
    const rows = await this.supabase.query<DbVerificationRow>(
      `
        select id, phone, code, expires_at, verified, verified_at, whatsapp_username, whatsapp_number
        from verification_codes
        where phone = $1
        limit 1
      `,
      [phone],
    );

    return rows[0] ?? null;
  }

  private mapRowToRecord(row: DbVerificationRow): VerificationRecord {
    return {
      phone: row.phone,
      code: row.code,
      expiresAt: this.parseTimestamp(row.expires_at) ?? new Date(),
      verified: row.verified,
      timestamp: this.parseTimestamp(row.verified_at),
      whatsappUsername: row.whatsapp_username ?? undefined,
      whatsappNumber: row.whatsapp_number ?? undefined,
    };
  }

  private parseTimestamp(value: string | null): Date | null {
    if (!value) {
      return null;
    }
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }

  private async deleteRow(id: number): Promise<void> {
    await this.supabase.query('delete from verification_codes where id = $1', [
      id,
    ]);
  }

  private ensureSupabaseReady(): void {
    if (!this.supabase.isEnabled()) {
      this.logger.error(
        'SupabaseService no está configurado. Asegúrate de definir SUPABASE_DB_URL o POSTGRES_URL* para habilitar verificaciones OTP.',
      );
      throw new Error(
        'Servicio de verificación OTP deshabilitado por falta de conexión a Supabase',
      );
    }
  }

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      const idx = Math.floor(Math.random() * alphabet.length);
      code += alphabet[idx];
    }
    return code;
  }

  private normalizePhone(phone: string): string {
    const digitsOnly = phone?.replace(/\D/g, '') ?? '';
    if (!digitsOnly) {
      throw new Error('Número de teléfono inválido para verificación');
    }
    return digitsOnly;
  }

  private extractCodeFromMessage(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const firstMarker = trimmed.indexOf('~*');
    if (firstMarker === -1) {
      return null;
    }

    const secondMarker = trimmed.indexOf('~*', firstMarker + 2);
    if (secondMarker > firstMarker + 2) {
      const candidate = trimmed.slice(firstMarker + 2, secondMarker).trim();
      return candidate.length ? candidate : null;
    }

    const closingMarker = trimmed.indexOf('*~', firstMarker + 2);
    if (closingMarker > firstMarker + 2) {
      const candidate = trimmed.slice(firstMarker + 2, closingMarker).trim();
      return candidate.length ? candidate : null;
    }

    return null;
  }
}

