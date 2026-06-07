import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { SurveyQuestionType } from '../../generated/prisma/enums';

export class ManualQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  optionText: string;
}

export class CreateManualQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  questionText: string;

  @IsEnum(SurveyQuestionType)
  type: SurveyQuestionType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ManualQuestionOptionDto)
  options?: ManualQuestionOptionDto[];
}
