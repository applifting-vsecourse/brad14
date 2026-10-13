import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._]+$/)
  username!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MaxLength(160)
  bio!: string;

  @IsIn(['none', 'happy', 'sad', 'angry', 'silly'])
  defaultMood!: 'none' | 'happy' | 'sad' | 'angry' | 'silly';
}
