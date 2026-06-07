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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  createBasicDetails(
    @User('sub') creatorId: string,
    @Body() body: CreateSurveyBasicDetailsRequestDto,
  ) {
    return this.surveyService.createBasicDetails(creatorId, body);
  }

  @Patch(':surveyId/method')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  selectMethod(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: SelectSurveyMethodDto,
  ) {
    return this.surveyService.selectMethod(
      creatorId,
      surveyId,
      body.creationMethod,
    );
  }

  @Post(':surveyId/questions/manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  createManualQuestion(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: CreateManualQuestionDto,
  ) {
    return this.surveyService.createManualQuestion(creatorId, surveyId, body);
  }

  @Post(':surveyId/questions/ai')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  generateAiQuestions(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: GenerateAiQuestionsDto,
  ) {
    return this.surveyService.generateAiQuestions(creatorId, surveyId, body);
  }

  @Get(':surveyId/questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  getSurveyQuestions(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  completeQuestionStep(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
  ) {
    return this.surveyService.completeQuestionStep(creatorId, surveyId);
  }

  @Patch(':surveyId/questions/:questionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  updateManualQuestion(
    @Param('surveyId') surveyId: string,
    @Param('questionId') questionId: string,
    @User('sub') creatorId: string,
    @Body() body: UpdateManualQuestionDto,
  ) {
    return this.surveyService.updateManualQuestion(
      creatorId,
      surveyId,
      questionId,
      body,
    );
  }

  @Delete(':surveyId/questions/:questionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  deleteQuestion(
    @Param('surveyId') surveyId: string,
    @Param('questionId') questionId: string,
    @User('sub') creatorId: string,
  ) {
    return this.surveyService.deleteQuestion(creatorId, surveyId, questionId);
  }
  @Patch(':surveyId/target-audience')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  setTargetAudience(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: SetTargetAudienceDto,
  ) {
    return this.surveyService.setTargetAudience(creatorId, surveyId, body);
  }
  @Patch(':surveyId/sample-budget')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  setSampleBudget(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: SetSampleBudgetDto,
  ) {
    return this.surveyService.setSampleBudget(creatorId, surveyId, body);
  }

  @Get(':surveyId/estimated-reach')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  getEstimatedReach(
    @Param('surveyId') surveyId: string,
    @User('sub') userId: string,
    @Query() query: EstimateAudienceReachQueryDto,
  ) {
    return this.surveyService.getEstimatedReach(userId, surveyId, query);
  }

  @Get(':surveyId/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  getSurveyPreview(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
  ) {
    return this.surveyService.getSurveyPreview(creatorId, surveyId);
  }

  @Patch(':surveyId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.BOTH)
  publishSurvey(
    @Param('surveyId') surveyId: string,
    @User('sub') creatorId: string,
    @Body() body: PublishSurveyDto,
  ) {
    return this.surveyService.publishSurvey(creatorId, surveyId, body);
  }
}
