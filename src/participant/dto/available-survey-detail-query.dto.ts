import { IsNotEmpty, IsString } from 'class-validator';

export class AvailableSurveyDetailQueryDto {
  @IsString()
  @IsNotEmpty()
  participantId: string;
}
