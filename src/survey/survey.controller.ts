import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { SurveyService } from './survey.service';
import { CreateSurveyBasicDetailsRequestDto } from './dto/create-survey-basic-details-request.dto';
import { SelectSurveyMethodDto } from './dto/select-survey-method.dto';
import { CreateManualQuestionDto } from './dto/create-manual-question.dto';
import { UpdateManualQuestionDto } from './dto/update-manual-question.dto';
import { CreatorIdDto } from './dto/creator-id.dto';
import { SetTargetAudienceDto } from './dto/set-target-audience.dto';

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

  @Post(':surveyId/questions/manual')
  createManualQuestion(
    @Param('surveyId') surveyId: string,
    @Body() body: CreateManualQuestionDto,
  ) {
    return this.surveyService.createManualQuestion(
      body.creatorId,
      surveyId,
      body,
    );
  }

  @Get(':surveyId/questions')
  getSurveyQuestions(
    @Param('surveyId') surveyId: string,
    @Query('creatorId') creatorId: string,
  ) {
    return this.surveyService.getSurveyQuestions(creatorId, surveyId);
  }

  @Patch(':surveyId/questions/complete')
  completeQuestionStep(
    @Param('surveyId') surveyId: string,
    @Body() body: CreatorIdDto,
  ) {
    return this.surveyService.completeQuestionStep(body.creatorId, surveyId);
  }

  @Patch(':surveyId/questions/:questionId')
  updateManualQuestion(
    @Param('surveyId') surveyId: string,
    @Param('questionId') questionId: string,
    @Body() body: UpdateManualQuestionDto,
  ) {
    return this.surveyService.updateManualQuestion(
      body.creatorId,
      surveyId,
      questionId,
      body,
    );
  }

  @Delete(':surveyId/questions/:questionId')
  deleteQuestion(
    @Param('surveyId') surveyId: string,
    @Param('questionId') questionId: string,
    @Body() body: CreatorIdDto,
  ) {
    return this.surveyService.deleteQuestion(
      body.creatorId,
      surveyId,
      questionId,
    );
  }
  @Patch(':surveyId/target-audience')
  setTargetAudience(
    @Param('surveyId') surveyId: string,
    @Body() body: SetTargetAudienceDto,
  ) {
    return this.surveyService.setTargetAudience(body.creatorId, surveyId, body);
  }
}
