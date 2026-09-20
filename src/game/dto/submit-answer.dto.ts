import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({
    description: 'Dữ liệu đáp án theo loại nhiệm vụ. Phát hiện sai lệch: suspiciousSegmentId, verdict, misinformationType. Kiểm chứng bằng chứng: evidenceId, reasoningId. Sắp xếp sự kiện: orderedIds.',
    example: { suspiciousSegmentId: 'purpose', verdict: 'FALSE', misinformationType: 'FALSE_FACT' },
  })
  @IsObject()
  answer!: Record<string, unknown>;
}

export class FindFakeAnswerDto {
  @IsString() suspiciousSegmentId!: string;
  @IsIn(['TRUE', 'FALSE', 'MISSING_CONTEXT']) verdict!: string;
  @IsString() misinformationType!: string;
}

export class EvidenceHuntAnswerDto {
  @IsArray() @IsString({ each: true }) evidenceIds!: string[];
}

export class TimelineAnswerDto {
  @IsArray() @IsString({ each: true }) orderedIds!: string[];
}

export class PlayerTokenHeaderDto {
  @ApiPropertyOptional({ name: 'x-player-token' })
  @IsOptional()
  @IsString()
  playerToken?: string;
}
