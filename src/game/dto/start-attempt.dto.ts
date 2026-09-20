import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StartAttemptDto {
  @ApiProperty({ example: 'cuid_challenge_id' })
  @IsString()
  challengeId!: string;
}
