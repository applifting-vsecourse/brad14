import { QuackFeedEntry } from '@/modules/quack/domain/quack-feed-entry';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuackResponseDto } from './quack.response.dto';

export class QuackFeedEntryResponseDto {
  @ApiProperty({ enum: ['quack', 'deleted'] })
  type!: 'quack' | 'deleted';

  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ minimum: 0 })
  replyCount!: number;

  @ApiPropertyOptional()
  text?: string;

  @ApiPropertyOptional({
    enum: ['happy', 'sad', 'angry', 'silly'],
    nullable: true,
  })
  mood?: QuackResponseDto['mood'];

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional({ type: Object })
  user?: QuackResponseDto['user'];

  @ApiPropertyOptional({ nullable: true, type: Object })
  poll?: QuackResponseDto['poll'];

  static fromDomain(entry: QuackFeedEntry): QuackFeedEntryResponseDto {
    if (entry.type === 'deleted') {
      return {
        type: 'deleted',
        id: entry.id,
        createdAt: entry.createdAt,
        replyCount: entry.replyCount,
      };
    }
    const quack = QuackResponseDto.fromDomain(entry);
    return { ...quack, type: 'quack', replyCount: entry.replyCount };
  }
}
