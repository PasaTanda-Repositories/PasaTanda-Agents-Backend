import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { ZkProofRequestDto } from './dto/enoki.dto';
import type {
  EnokiZkProofPayload,
  EnokiZkProofResponse,
} from './types/enoki.types';

const DEFAULT_ENOKI_API_URL = 'https://api.enoki.mystenlabs.com';

@Injectable()
export class EnokiService {
  private readonly logger = new Logger(EnokiService.name);
  private readonly baseUrl: string;
  private readonly privateKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const rawUrl = this.config.get<string>('ENOKI_API_URL')?.trim();
    this.baseUrl = rawUrl ? rawUrl.replace(/\/+$/, '') : DEFAULT_ENOKI_API_URL;
    this.privateKey = this.config.get<string>('ENOKI_PRIVATE_API_KEY')?.trim() ?? '';
  }

  async requestProof(
    zkLoginJwt: string,
    payload: ZkProofRequestDto,
  ): Promise<EnokiZkProofPayload> {
    if (!zkLoginJwt) {
      throw new BadRequestException('El header zklogin-jwt es obligatorio');
    }

    if (!this.privateKey) {
      throw new InternalServerErrorException(
        'No se configuró la clave privada de Enoki',
      );
    }

    try {
      const url = `${this.baseUrl}/v1/zklogin/zkp`;
      const response = await firstValueFrom(
        this.http.post<EnokiZkProofResponse>(url, payload, {
          headers: {
            Authorization: this.privateKey,
            'Content-Type': 'application/json',
            'zklogin-jwt': zkLoginJwt,
          },
        }),
      );
      return response.data.data;
    } catch (error) {
      this.logger.error('Error obteniendo prueba zk de Enoki', error as Error);
      throw new InternalServerErrorException(
        'No se pudo obtener la prueba zk de Enoki',
      );
    }
  }
}
