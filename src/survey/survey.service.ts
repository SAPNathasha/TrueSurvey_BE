import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { CreateSurveyBasicDetailsDto } from './dto/create-survey-basic-details.dto';
import {
  SurveyCreationMethod,
  SurveyCreationStep,
  SurveyStatus,
} from '../generated/prisma/enums';

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  async createBasicDetails(
    creatorId: string,
    dto: CreateSurveyBasicDetailsDto,
  ) {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    const creator = await this.prisma.user.findUnique({
      where: {
        id: creatorId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!creator) {
      throw new BadRequestException('Creator not found');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'BOTH') {
      throw new ForbiddenException('Only creators can create surveys');
    }

    const survey = await this.prisma.survey.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        estimatedCompletionDays: dto.estimatedCompletionDays,
        status: SurveyStatus.DRAFT,
        currentStep: SurveyCreationStep.SELECT_METHOD,
        creatorId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        audience: true,
        estimatedCompletionDays: true,
        status: true,
        currentStep: true,
        creationMethod: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Survey basic details saved successfully',
      survey,
    };
  }

  async selectMethod(
    creatorId: string,
    surveyId: string,
    creationMethod: SurveyCreationMethod,
  ) {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    if (!surveyId) {
      throw new BadRequestException('surveyId is required');
    }

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        creatorId: true,
        status: true,
        currentStep: true,
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    if (survey.creatorId !== creatorId) {
      throw new ForbiddenException('You cannot update this survey');
    }

    if (survey.status !== SurveyStatus.DRAFT) {
      throw new BadRequestException('Only draft surveys can be edited');
    }

    const updatedSurvey = await this.prisma.survey.update({
      where: {
        id: surveyId,
      },
      data: {
        creationMethod,
        currentStep: SurveyCreationStep.CREATE_QUESTIONS,
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        audience: true,
        estimatedCompletionDays: true,
        status: true,
        currentStep: true,
        creationMethod: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Survey creation method saved successfully',
      survey: updatedSurvey,
      nextStep:
        creationMethod === SurveyCreationMethod.AI_ASSISTED
          ? 'AI_QUESTION_GENERATION'
          : 'MANUAL_QUESTION_CREATION',
    };
  }
}
