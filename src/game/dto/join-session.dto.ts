import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class JoinSessionDto {
  @ApiProperty({ example: '8F2KQ' })
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,10}$/)
  code!: string;

  @ApiProperty({ example: 'Minh' })
  @IsString()
  @Length(2, 30)
  nickname!: string;
}
