import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { SurveyCreationMethod } from '../../generated/prisma/enums';

export class SelectSurveyMethodDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @IsEnum(SurveyCreationMethod)
  creationMethod: SurveyCreationMethod;
}
