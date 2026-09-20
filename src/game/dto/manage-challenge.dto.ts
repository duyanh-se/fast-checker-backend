import { PartialType } from '@nestjs/swagger';
import { ChallengeType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateChallengeDto {
  @IsInt() @Min(1) @Max(99) @Type(() => Number)
  order!: number;

  @IsEnum(ChallengeType)
  type!: ChallengeType;

  @IsString() @MaxLength(120)
  title!: string;

  @IsString() @MaxLength(1000)
  instructions!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsObject()
  solution!: Record<string, unknown>;

  @IsInt() @Min(15) @Max(900) @Type(() => Number)
  timeLimit!: number;

  @IsInt() @Min(0) @Max(10000) @Type(() => Number)
  baseScore!: number;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateChallengeDto extends PartialType(CreateChallengeDto) {}
