import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, MinLength, ValidateIf } from 'class-validator';

export class SetPollVoteDto {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @IsString()
  @MinLength(1)
  optionId!: string | null;
}
