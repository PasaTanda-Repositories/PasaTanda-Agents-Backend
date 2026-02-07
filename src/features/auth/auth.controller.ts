import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EnokiService } from './enoki.service';
import { TokenService } from '../../common/security/token.service';
import { VerificationService } from '../login/verification.service';
import { ZkProofRequestDto } from './dto/enoki.dto';
import {
  LoginRequestDto,
  PhoneOtpRequestDto,
  PhoneStatusQueryDto,
} from './dto/auth.dto';
import type { EnokiZkProofPayload } from './types/enoki.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly verification: VerificationService,
    private readonly enoki: EnokiService,
  ) {}

  @Get('salt')
  @ApiOperation({ summary: 'Obtiene salt de un usuario existente' })
  @ApiHeader({ name: 'x-oauth-token', required: true })
  @ApiHeader({ name: 'x-auth-provider', required: false })
  async getSalt(
    @Headers('x-oauth-token') jwt: string,
    @Headers('x-auth-provider') provider?: string,
  ): Promise<{ exists: boolean; salt: string | null }> {
    return this.auth.getSalt({ jwt, provider });
  }

  @Post('login')
  @ApiOperation({ summary: 'Inicia sesion y devuelve access token' })
  @ApiHeader({ name: 'x-auth-provider', required: false })
  @ApiOkResponse({ description: 'Sesion iniciada' })
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

  @Post('zkp')
  @ApiOperation({ summary: 'Solicita una prueba zk a Enoki' })
  @ApiHeader({ name: 'zklogin-jwt', required: true })
  @ApiOkResponse({ description: 'Respuesta de Enoki con la prueba zk' })
  async requestZkProof(
    @Headers('zklogin-jwt') zkLoginJwt: string,
    @Body() body: ZkProofRequestDto,
  ): Promise<EnokiZkProofPayload> {
    if (!zkLoginJwt) {
      throw new BadRequestException('Header zklogin-jwt es obligatorio');
    }

    return this.enoki.requestProof(zkLoginJwt, body);
  }

  @Post('phone/otp')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicita OTP para vincular telefono' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta estado de verificacion de telefono' })
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
