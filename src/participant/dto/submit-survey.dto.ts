import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SubmitSurveyAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsOptional()
  answerText?: string;

  @IsString()
  @IsOptional()
  selectedOptionId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedOptionIds?: string[];

  @IsNumber()
  @IsOptional()
  ratingValue?: number;

  @IsBoolean()
  @IsOptional()
  yesNoValue?: boolean;
}

export class SubmitSurveyDto {
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitSurveyAnswerDto)
  answers: SubmitSurveyAnswerDto[];
}
