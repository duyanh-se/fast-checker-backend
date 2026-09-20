import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 'Lớp Tư tưởng Hồ Chí Minh - Nhóm 4' })
  @IsString()
  @Length(3, 100)
  title!: string;

  @ApiProperty({ required: false, example: 'HCM2026' })
  @IsOptional()
  @IsString()
  @Length(4, 10)
  code?: string;
}
