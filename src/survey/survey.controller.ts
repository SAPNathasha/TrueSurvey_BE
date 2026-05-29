import { Body, Controller, Post } from '@nestjs/common';

import { SurveyService } from './survey.service';
import { CreateSurveyBasicDetailsDto } from './dto/create-survey-basic-details.dto';

@Controller('surveys')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Post('basic-details')
  createBasicDetails(
    @Body() body: CreateSurveyBasicDetailsDto & { creatorId: string },
  ) {
    return this.surveyService.createBasicDetails(body.creatorId, body);
  }
}
