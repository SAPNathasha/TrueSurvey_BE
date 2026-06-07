import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AudienceGender,
  SurveyAudienceType,
} from '../../generated/prisma/enums';

export class SetTargetAudienceDto {
  @IsInt()
  @Min(13)
  @Max(100)
  @IsOptional()
  minimumAge?: number;

  @IsInt()
  @Min(13)
  @Max(100)
  @IsOptional()
  maximumAge?: number;

  @IsEnum(AudienceGender)
  @IsOptional()
  gender?: AudienceGender;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  educationLevel?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  occupation?: string;

  @IsEnum(SurveyAudienceType)
  sampleBase: SurveyAudienceType;
}
