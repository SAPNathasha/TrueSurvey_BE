import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { CreateSurveyBasicDetailsDto } from './dto/create-survey-basic-details.dto';
import { GenerateAiQuestionsDto } from './dto/generate-ai-questions.dto';
import {
  SurveyCreationMethod,
  SurveyCreationStep,
  SurveyQuestionSource,
  SurveyQuestionType,
  SurveyStatus,
} from '../generated/prisma/enums';

type GeneratedQuestion = {
  questionText: string;
  type: SurveyQuestionType;
  options: string[];
  isRequired: boolean;
};

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
        creatorId: true,
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
        creatorId: true,
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

  async generateAiQuestions(
    creatorId: string,
    surveyId: string,
    dto: GenerateAiQuestionsDto,
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
        creationMethod: true,
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

    if (survey.creationMethod !== SurveyCreationMethod.AI_ASSISTED) {
      throw new BadRequestException(
        'This survey is not configured for AI-assisted question generation',
      );
    }

    const generatedQuestions = this.generateMockAiQuestions(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.surveyQuestion.deleteMany({
        where: {
          surveyId,
          source: SurveyQuestionSource.AI_GENERATED,
        },
      });

      for (let i = 0; i < generatedQuestions.length; i += 1) {
        const generatedQuestion = generatedQuestions[i];

        const question = await tx.surveyQuestion.create({
          data: {
            surveyId,
            questionText: generatedQuestion.questionText,
            type: generatedQuestion.type,
            source: SurveyQuestionSource.AI_GENERATED,
            order: i + 1,
            isRequired: generatedQuestion.isRequired,
          },
        });

        if (generatedQuestion.options.length > 0) {
          await tx.surveyQuestionOption.createMany({
            data: generatedQuestion.options.map((optionText, optionIndex) => ({
              questionId: question.id,
              optionText,
              order: optionIndex + 1,
            })),
          });
        }
      }

      await tx.survey.update({
        where: {
          id: surveyId,
        },
        data: {
          currentStep: SurveyCreationStep.TARGET_AUDIENCE,
        },
      });
    });

    const questions = await this.prisma.surveyQuestion.findMany({
      where: {
        surveyId,
      },
      orderBy: {
        order: 'asc',
      },
      select: {
        id: true,
        questionText: true,
        type: true,
        source: true,
        order: true,
        isRequired: true,
        options: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            optionText: true,
            order: true,
          },
        },
      },
    });

    return {
      message: 'AI questions generated successfully',
      surveyId,
      currentStep: SurveyCreationStep.TARGET_AUDIENCE,
      questions,
    };
  }

  private generateMockAiQuestions(
    dto: GenerateAiQuestionsDto,
  ): GeneratedQuestion[] {
    const requestedCount = dto.numberOfQuestions;

    const baseQuestions: GeneratedQuestion[] = [
      {
        questionText: `How satisfied are you with your overall experience with ${dto.surveyTitle}?`,
        type: SurveyQuestionType.RATING_SCALE,
        options: ['1', '2', '3', '4', '5'],
        isRequired: true,
      },
      {
        questionText: 'Which part of the service are you most satisfied with?',
        type: SurveyQuestionType.MULTIPLE_CHOICE,
        options: [
          'Product quality',
          'Delivery speed',
          'Customer support',
          'Pricing',
        ],
        isRequired: true,
      },
      {
        questionText: 'How likely are you to recommend this service to others?',
        type: SurveyQuestionType.RATING_SCALE,
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        isRequired: true,
      },
      {
        questionText: 'What could we improve to serve you better?',
        type: SurveyQuestionType.SHORT_ANSWER,
        options: [],
        isRequired: false,
      },
      {
        questionText: 'How would you rate the quality of customer support?',
        type: SurveyQuestionType.RATING_SCALE,
        options: ['1', '2', '3', '4', '5'],
        isRequired: true,
      },
      {
        questionText: 'Was the delivery process convenient for you?',
        type: SurveyQuestionType.SINGLE_SELECT,
        options: ['Yes', 'No', 'Somewhat'],
        isRequired: true,
      },
      {
        questionText: 'Which areas should we focus on improving?',
        type: SurveyQuestionType.MULTIPLE_CHOICE,
        options:
          dto.focusAreas.length > 0
            ? dto.focusAreas
            : ['Quality', 'Support', 'Delivery', 'Pricing'],
        isRequired: true,
      },
      {
        questionText: 'How clear was the information provided before purchase?',
        type: SurveyQuestionType.RATING_SCALE,
        options: ['1', '2', '3', '4', '5'],
        isRequired: true,
      },
      {
        questionText: 'What was the main reason for choosing our service?',
        type: SurveyQuestionType.SINGLE_SELECT,
        options: [
          'Price',
          'Quality',
          'Recommendation',
          'Convenience',
          'Brand trust',
        ],
        isRequired: true,
      },
      {
        questionText: 'Please share any additional feedback or suggestions.',
        type: SurveyQuestionType.LONG_ANSWER,
        options: [],
        isRequired: false,
      },
    ];

    if (requestedCount <= baseQuestions.length) {
      return baseQuestions.slice(0, requestedCount);
    }

    const questions = [...baseQuestions];

    for (let i = baseQuestions.length + 1; i <= requestedCount; i += 1) {
      questions.push({
        questionText: `Additional feedback question ${i} for ${dto.surveyTitle}`,
        type: SurveyQuestionType.SHORT_ANSWER,
        options: [],
        isRequired: false,
      });
    }

    return questions;
  }
}
