import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { FrequencyType } from '../types/group-creation.types';

const frequencyValues: FrequencyType[] = ['WEEKLY', 'MONTHLY', 'BIWEEKLY'];

export class CreateGroupDto {
  @ApiProperty({ example: 'Tanda Oficina' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  contributionAmount!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  guaranteeAmount!: number;

  @ApiProperty({ enum: frequencyValues })
  @IsEnum(frequencyValues)
  frequency!: FrequencyType;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  totalRounds!: number;
}

export class JoinGroupDto {
  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsNumber()
  turnNumber?: number;
}
