import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CreatorService } from './creator.service';
import { GetSurveysQueryDto } from './dto/get-surveys-query.dto';
import { GetSurveySubmissionsQueryDto } from './dto/get-survey-submissions-query.dto';
import { BulkReviewSubmissionsDto } from './dto/bulk-review-submissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('creator')
export class CreatorController {
  constructor(private readonly creatorService: CreatorService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  getDashboard(@User('sub') creatorId: string) {
    return this.creatorService.getDashboard(creatorId);
  }

  @Get('surveys')
  @UseGuards(JwtAuthGuard)
  getSurveys(
    @User('sub') creatorId: string,
    @Query() query: GetSurveysQueryDto,
  ) {
    return this.creatorService.getSurveys(creatorId, query.status, query.limit);
  }

  @Get('survey-submissions')
  @UseGuards(JwtAuthGuard)
  getSurveySubmissions(
    @Query('surveyId') surveyId: string,
    @Query() query: GetSurveySubmissionsQueryDto,
    @User('sub') creatorId: string,
  ) {
    return this.creatorService.getSurveySubmissions(
      creatorId,
      surveyId,
      query.page,
      query.limit,
    );
  }

  @Get('surveys/:surveyId/submissions/:submissionId')
  @UseGuards(JwtAuthGuard)
  getSingleSubmission(
    @Param('surveyId') surveyId: string,
    @Param('submissionId') submissionId: string,
    @User('sub') creatorId: string,
  ) {
    return this.creatorService.getSingleSubmission(
      creatorId,
      surveyId,
      submissionId,
    );
  }

  @Patch('surveys/:surveyId/submissions/:submissionId/accept')
  @UseGuards(JwtAuthGuard)
  acceptSubmission(
    @Param('surveyId') surveyId: string,
    @Param('submissionId') submissionId: string,
    @User('sub') creatorId: string,
  ) {
    return this.creatorService.acceptSubmission(
      creatorId,
      surveyId,
      submissionId,
    );
  }

  @Patch('surveys/:surveyId/submissions/:submissionId/reject')
  @UseGuards(JwtAuthGuard)
  rejectSubmission(
    @Param('surveyId') surveyId: string,
    @Param('submissionId') submissionId: string,
    @User('sub') creatorId: string,
  ) {
    return this.creatorService.rejectSubmission(
      creatorId,
      surveyId,
      submissionId,
    );
  }

  @Patch('surveys/:surveyId/submissions/bulk/accept')
  @UseGuards(JwtAuthGuard)
  bulkAcceptSubmissions(
    @Param('surveyId') surveyId: string,
    @Body() dto: BulkReviewSubmissionsDto,
    @User('sub') creatorId: string,
  ) {
    return this.creatorService.bulkAcceptSubmissions(
      creatorId,
      surveyId,
      dto.submissionIds,
    );
  }

  @Patch('surveys/:surveyId/submissions/bulk/reject')
  @UseGuards(JwtAuthGuard)
  bulkRejectSubmissions(
    @Param('surveyId') surveyId: string,
    @Body() dto: BulkReviewSubmissionsDto,
    @User('sub') creatorId: string,
  ) {
    return this.creatorService.bulkRejectSubmissions(
      creatorId,
      surveyId,
      dto.submissionIds,
    );
  }
}
