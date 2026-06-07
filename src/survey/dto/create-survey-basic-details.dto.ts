import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SurveyCategory } from '../../generated/prisma/enums';

export class CreateSurveyBasicDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsEnum(SurveyCategory)
  category: SurveyCategory;

  @IsInt()
  @Min(1)
  @Max(365)
  estimatedCompletionDays: number;

  @IsInt()
  @Min(1)
  surveyClosingTime: number;
}
