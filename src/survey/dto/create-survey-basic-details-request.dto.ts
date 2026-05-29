import { IsNotEmpty, IsString } from 'class-validator';

import { CreateSurveyBasicDetailsDto } from './create-survey-basic-details.dto';

export class CreateSurveyBasicDetailsRequestDto extends CreateSurveyBasicDetailsDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;
}
