import { IsEnum } from 'class-validator';

import { SurveyCreationMethod } from '../../generated/prisma/enums';

export class SelectSurveyMethodDto {
  @IsEnum(SurveyCreationMethod)
  creationMethod: SurveyCreationMethod;
}
