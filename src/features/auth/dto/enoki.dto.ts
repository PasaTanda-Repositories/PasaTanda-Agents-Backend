import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ZkProofRequestDto {
  @ApiProperty({
    description: 'Clave pública efímera generada durante zkLogin',
    example: 'string',
  })
  @IsString()
  @IsNotEmpty()
  ephemeralPublicKey!: string;

  @ApiProperty({
    description: 'Valor maxEpoch devuelto por zkLogin',
    example: 0,
  })
  @Type(() => Number)
  @IsNumber()
  maxEpoch!: number;

  @ApiProperty({
    description: 'Randomness devuelto por zkLogin',
    example: 'string',
  })
  @IsString()
  @IsNotEmpty()
  randomness!: string;

  @ApiProperty({
    description: 'Red de Sui para la prueba',
    example: 'testnet',
    required: false,
  })
  @IsOptional()
  @IsString()
  network?: string;
}
