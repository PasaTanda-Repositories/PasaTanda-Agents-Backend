import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/intraestructure/supabase/supabase.service';
import { TokenService } from '../../common/security/token.service';
import {
  NotifySuccessDto,
  SponsorCreateDto,
  SponsorDepositDto,
  SponsorPayoutDto,
} from './dto/tx.dto';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('tx')
export class TransactionsController {
  constructor(
    private readonly tokens: TokenService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('sponsor/create')
  @ApiOperation({ summary: 'Crea transaccion sponsor de garantia' })
  async sponsorCreate(
    @Headers('authorization') authorization: string,
    @Body() body: SponsorCreateDto,
  ): Promise<{ sponsoredSignature: string; txBytes: string }> {
    const { userId } = this.resolveUser(authorization);
    await this.recordTransaction({
      groupId: body.groupId ?? null,
      userId,
      type: 'GUARANTEE_DEPOSIT',
      method: 'SUI_NATIVE',
      suiDigest: null,
    });

    return {
      sponsoredSignature: this.buildMockSignature(body.txBytes),
      txBytes: body.txBytes,
    };
  }

  @Post('sponsor/deposit')
  @ApiOperation({ summary: 'Crea transaccion sponsor de aporte' })
  async sponsorDeposit(
    @Headers('authorization') authorization: string,
    @Body() body: SponsorDepositDto,
  ): Promise<{ sponsoredSignature: string; txBytes: string }> {
    const { userId } = this.resolveUser(authorization);
    await this.recordTransaction({
      groupId: body.transactionId ?? null,
      userId,
      type: 'CONTRIBUTION',
      method: 'SUI_NATIVE',
      suiDigest: null,
    });

    return {
      sponsoredSignature: this.buildMockSignature(body.txBytes),
      txBytes: body.txBytes,
    };
  }

  @Post('sponsor/payout')
  @ApiOperation({ summary: 'Crea transaccion sponsor para payout' })
  async sponsorPayout(
    @Headers('authorization') authorization: string,
    @Body() body: SponsorPayoutDto,
  ): Promise<{ sponsoredSignature: string; txBytes: string }> {
    const { userId } = this.resolveUser(authorization);
    await this.recordTransaction({
      groupId: body.groupId,
      userId,
      type: 'PAYOUT',
      method: body.mode === 'FIAT' ? 'FIAT_RELAYER' : 'SUI_NATIVE',
      suiDigest: null,
    });

    return {
      sponsoredSignature: this.buildMockSignature(body.txBytes),
      txBytes: body.txBytes,
    };
  }

  @Post('notify-success')
  @ApiOperation({ summary: 'Marca transaccion confirmada con digest' })
  @ApiOkResponse({ description: 'Registro actualizado o creado' })
  async notifySuccess(
    @Headers('authorization') authorization: string,
    @Body() body: NotifySuccessDto,
  ): Promise<{ updated: boolean }> {
    const { userId } = this.resolveUser(authorization);
    const result = await this.supabase.query(
      `update transactions set status = 'CONFIRMED', sui_digest = $1 where group_id = $2 and user_id = $3 returning id`,
      [body.digest, body.groupId, userId],
    );

    if (result.length === 0) {
      await this.recordTransaction({
        groupId: body.groupId,
        userId,
        type: 'CONTRIBUTION',
        method: 'SUI_NATIVE',
        suiDigest: body.digest,
      });
    }

    return { updated: true };
  }

  @Get('payment-link/:id')
  @ApiOperation({ summary: 'Obtiene estado de link de pago' })
  async getPaymentLink(@Param('id') id: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    concept: string;
  }> {
    const rows = await this.supabase.query<{
      id: string;
      status: string;
      amount_usdc: string | null;
      external_payment_url: string | null;
    }>(
      'select id, status, amount_usdc as amount_usdc, external_payment_url from transactions where id = $1 limit 1',
      [id],
    );

    const row = rows[0];
    return {
      id,
      status: row?.status ?? 'PENDING',
      amount: row?.amount_usdc ? Number(row.amount_usdc) : 0,
      currency: 'USDC',
      concept: row?.external_payment_url ?? 'Pago pendiente',
    };
  }

  private async recordTransaction(params: {
    groupId: string | null;
    userId: string;
    type: string;
    method: string;
    suiDigest: string | null;
  }): Promise<void> {
    await this.supabase.query(
      `insert into transactions (group_id, user_id, type, method, status, sui_digest)
       values ($1, $2, $3, $4, 'PENDING', $5)
       on conflict do nothing`,
      [
        params.groupId,
        params.userId,
        params.type,
        params.method,
        params.suiDigest,
      ],
    );
  }

  private resolveUser(authorization?: string): { userId: string } {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header inválido');
    }
    const token = authorization.slice('Bearer '.length).trim();
    const payload = this.tokens.verifyToken(token);
    return { userId: payload.userId };
  }

  private buildMockSignature(txBytes: string): string {
    return `${txBytes.slice(0, 6)}.${randomBytes(8).toString('hex')}`;
  }
}
