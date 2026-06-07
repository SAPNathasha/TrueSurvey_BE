import {
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';

import { SurveyPublishOption } from '../../generated/prisma/enums';

export class PublishSurveyDto {
  @IsEnum(SurveyPublishOption)
  publishOption: SurveyPublishOption;

  @IsDateString()
  @IsOptional()
  scheduledPublishAt?: string;
}
