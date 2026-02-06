import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SponsorCreateDto {
  @ApiProperty({ description: 'TransactionBlock serializado en Base64' })
  @IsString()
  @IsNotEmpty()
  txBytes!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  groupId?: string;
}

export class SponsorDepositDto {
  @ApiProperty({ description: 'TransactionBlock serializado en Base64' })
  @IsString()
  @IsNotEmpty()
  txBytes!: string;

  @ApiProperty({ required: false, description: 'ID de transacción opcional' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class SponsorPayoutDto {
  @ApiProperty({ description: 'TransactionBlock serializado en Base64' })
  @IsString()
  @IsNotEmpty()
  txBytes!: string;

  @ApiProperty({ description: 'ID de grupo' })
  @IsString()
  @IsNotEmpty()
  groupId!: string;

  @ApiProperty({ example: 'FIAT' })
  @IsString()
  @IsNotEmpty()
  mode!: string;
}

export class NotifySuccessDto {
  @ApiProperty({ example: '0xTxHash...' })
  @IsString()
  @IsNotEmpty()
  digest!: string;

  @ApiProperty({ example: 'uuid-group' })
  @IsString()
  @IsNotEmpty()
  groupId!: string;
}
