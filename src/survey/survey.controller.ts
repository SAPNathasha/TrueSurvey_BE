import { Body, Controller, Param, Patch, Post } from '@nestjs/common';

import { SurveyService } from './survey.service';
import { CreateSurveyBasicDetailsRequestDto } from './dto/create-survey-basic-details-request.dto';
import { SelectSurveyMethodDto } from './dto/select-survey-method.dto';
import { GenerateAiQuestionsDto } from './dto/generate-ai-questions.dto';

@Controller('surveys')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Post('basic-details')
  createBasicDetails(@Body() body: CreateSurveyBasicDetailsRequestDto) {
    return this.surveyService.createBasicDetails(body.creatorId, body);
  }

  @Patch(':surveyId/method')
  selectMethod(
    @Param('surveyId') surveyId: string,
    @Body() body: SelectSurveyMethodDto,
  ) {
    return this.surveyService.selectMethod(
      body.creatorId,
      surveyId,
      body.creationMethod,
    );
  }

  @Post(':surveyId/ai-generate-questions')
  generateAiQuestions(
    @Param('surveyId') surveyId: string,
    @Body() body: GenerateAiQuestionsDto,
  ) {
    return this.surveyService.generateAiQuestions(
      body.creatorId,
      surveyId,
      body,
    );
  }
}
