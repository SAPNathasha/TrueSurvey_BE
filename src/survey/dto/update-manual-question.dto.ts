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

export class UpdateManualQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  optionText: string;
}

export class UpdateManualQuestionDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  questionText?: string;

  @IsEnum(SurveyQuestionType)
  @IsOptional()
  type?: SurveyQuestionType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateManualQuestionOptionDto)
  options?: UpdateManualQuestionOptionDto[];
}
