import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SurveyService } from './survey.service';
import { CreateSurveyBasicDetailsRequestDto } from './dto/create-survey-basic-details-request.dto';
import { SelectSurveyMethodDto } from './dto/select-survey-method.dto';
import { CreateManualQuestionDto } from './dto/create-manual-question.dto';
import { UpdateManualQuestionDto } from './dto/update-manual-question.dto';
import { CreatorIdDto } from './dto/creator-id.dto';
import { SetTargetAudienceDto } from './dto/set-target-audience.dto';
import { SetSampleBudgetDto } from './dto/set-sample-budget.dto';
import { PublishSurveyDto } from './dto/publish-survey.dto';
import { EstimateAudienceReachQueryDto } from './dto/estimate-audience-reach-query.dto';
import { GenerateAiQuestionsDto } from './dto/generate-ai-questions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../generated/prisma/enums';

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

  @Post(':surveyId/questions/ai')
  @UseGuards(JwtAuthGuard)
  generateAiQuestions(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: GenerateAiQuestionsDto,
  ) {
    return this.surveyService.generateAiQuestions(creatorId, surveyId, body);
  }

  @Get(':surveyId/questions')
  getSurveyQuestions(
    @Param('surveyId') surveyId: string,
    @Query('creatorId') creatorId: string,
  ) {
    return this.surveyService.getSurveyQuestions(creatorId, surveyId);
  }

  @Get(':surveyId/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  getSurveyAnalytics(
    @Param('surveyId') surveyId: string,
    @User('sub') userId: string,
  ) {
    return this.surveyService.getSurveyAnalytics(userId, surveyId);
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
  @Patch(':surveyId/sample-budget')
  setSampleBudget(
    @Param('surveyId') surveyId: string,
    @Body() body: SetSampleBudgetDto,
  ) {
    return this.surveyService.setSampleBudget(body.creatorId, surveyId, body);
  }

  @Get(':surveyId/estimated-reach')
  getEstimatedReach(
    @Param('surveyId') surveyId: string,
    @Query() query: EstimateAudienceReachQueryDto,
  ) {
    return this.surveyService.getEstimatedReach(query.userId, surveyId, query);
  }

  @Get(':surveyId/preview')
  getSurveyPreview(
    @Param('surveyId') surveyId: string,
    @Query('creatorId') creatorId: string,
  ) {
    return this.surveyService.getSurveyPreview(creatorId, surveyId);
  }

  @Patch(':surveyId/publish')
  publishSurvey(
    @Param('surveyId') surveyId: string,
    @Body() body: PublishSurveyDto,
  ) {
    return this.surveyService.publishSurvey(body.creatorId, surveyId, body);
  }
}
