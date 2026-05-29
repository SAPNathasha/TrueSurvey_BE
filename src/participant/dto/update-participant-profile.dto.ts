import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { AudienceGender } from '../../generated/prisma/enums';

export class UpdateParticipantProfileDto {
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  phoneCountryCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phoneNumber?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(AudienceGender)
  @IsOptional()
  participantGender?: AudienceGender;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  participantCity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  participantDistrict?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  participantEducationLevel?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  participantOccupation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  participantAddress?: string;

  @Type(() => Number)
  @IsInt()
  @Min(13)
  @Max(100)
  @IsOptional()
  participantAge?: number;
}
