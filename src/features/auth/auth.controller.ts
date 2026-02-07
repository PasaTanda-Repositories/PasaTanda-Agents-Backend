import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../../common/security/token.service';
import { VerificationService } from '../login/verification.service';
import {
  LoginRequestDto,
  PhoneOtpRequestDto,
  PhoneStatusQueryDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly verification: VerificationService,
  ) {}

  @Get('salt')
  async getSalt(
    @Headers('x-oauth-token') jwt: string,
    @Headers('x-auth-provider') provider?: string,
  ): Promise<{ exists: boolean; salt: string | null }> {
    return this.auth.getSalt({ jwt, provider });
  }

  @Post('login')
  async login(
    @Body() body: LoginRequestDto,
    @Headers('x-auth-provider') provider?: string,
  ): Promise<{
    accessToken: string;
    user: {
      id: string;
      suiAddress: string;
      phoneVerified: boolean;
      status: string;
    };
  }> {
    return this.auth.login(body, provider);
  }

  @Post('phone/otp')
  async requestOtp(
    @Headers('authorization') authorization: string,
    @Body() body: PhoneOtpRequestDto,
  ): Promise<{ code: string; instruction: string }> {
    const token = this.extractBearer(authorization);
    const payload = this.tokens.verifyToken(token);

    await this.auth.setUserPhonePending(payload.userId, body.phone);
    const { code } = await this.verification.issueCode(body.phone);

    return {
      code,
      instruction: 'Envía este código a nuestro bot de WhatsApp',
    };
  }

  @Get('phone/status')
  async status(
    @Headers('authorization') authorization: string,
    @Query() query: PhoneStatusQueryDto,
  ): Promise<{ verified: boolean; linkedAt: string | null }> {
    const token = this.extractBearer(authorization);
    this.tokens.verifyToken(token);

    const status = await this.verification.getStatus(query.phone);
    return {
      verified: status.verified,
      linkedAt: status.linkedAt ? status.linkedAt.toISOString() : null,
    };
  }

  private extractBearer(header?: string): string {
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header inválido');
    }
    return header.slice('Bearer '.length).trim();
  }
}
