import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { AiAnswerStyle, AiToneStyle } from '../../generated/prisma/enums';

export class GenerateAiQuestionsDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  surveyTitle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  surveyGoal: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  focusAreas: string[];

  @IsInt()
  @Min(1)
  @Max(50)
  numberOfQuestions: number;

  @IsEnum(AiAnswerStyle)
  preferredAnswerStyle: AiAnswerStyle;

  @IsEnum(AiToneStyle)
  toneStyle: AiToneStyle;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  additionalInstructions?: string;
}
