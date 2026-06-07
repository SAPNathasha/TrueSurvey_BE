import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsUUID()
  @IsOptional()
  province?: string;

  @IsUUID()
  @IsOptional()
  city?: string;

  @IsUUID()
  @IsOptional()
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
