import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { SurveyPublishOption } from '../../generated/prisma/enums';

export class PublishSurveyDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @IsEnum(SurveyPublishOption)
  publishOption: SurveyPublishOption;

  @IsDateString()
  @IsOptional()
  scheduledPublishAt?: string;
}
