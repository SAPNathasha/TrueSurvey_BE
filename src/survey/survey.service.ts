import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { CreateSurveyBasicDetailsDto } from './dto/create-survey-basic-details.dto';
import { GenerateAiQuestionsDto } from './dto/generate-ai-questions.dto';
import { CreateManualQuestionDto } from './dto/create-manual-question.dto';
import { UpdateManualQuestionDto } from './dto/update-manual-question.dto';
import { SetTargetAudienceDto } from './dto/set-target-audience.dto';

import {
  AudienceGender,
  SurveyAudienceType,
  SurveyCreationMethod,
  SurveyCreationStep,
  SurveyQuestionSource,
  SurveyQuestionType,
  SurveyStatus,
  UserRole,
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

    if (creator.role !== UserRole.CREATOR && creator.role !== UserRole.BOTH) {
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
    await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
      expectedMethod: SurveyCreationMethod.AI_ASSISTED,
    });

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
          currentStep: SurveyCreationStep.CREATE_QUESTIONS,
        },
      });
    });

    const questions = await this.getQuestionsBySurveyId(surveyId);

    return {
      message: 'AI questions generated successfully',
      surveyId,
      currentStep: SurveyCreationStep.CREATE_QUESTIONS,
      questions,
    };
  }

  async createManualQuestion(
    creatorId: string,
    surveyId: string,
    dto: CreateManualQuestionDto,
  ) {
    await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
      expectedMethod: SurveyCreationMethod.MANUAL,
    });

    this.validateQuestionOptions(dto.type, dto.options ?? []);

    const lastQuestion = await this.prisma.surveyQuestion.findFirst({
      where: {
        surveyId,
      },
      orderBy: {
        order: 'desc',
      },
      select: {
        order: true,
      },
    });

    const nextOrder = (lastQuestion?.order ?? 0) + 1;

    const question = await this.prisma.surveyQuestion.create({
      data: {
        surveyId,
        questionText: dto.questionText,
        type: dto.type,
        source: SurveyQuestionSource.MANUAL,
        order: nextOrder,
        isRequired: dto.isRequired ?? true,
        options: {
          create: (dto.options ?? []).map((option, index) => ({
            optionText: option.optionText,
            order: index + 1,
          })),
        },
      },
      select: {
        id: true,
        questionText: true,
        type: true,
        source: true,
        order: true,
        isRequired: true,
        createdAt: true,
        updatedAt: true,
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
      message: 'Manual question added successfully',
      question,
    };
  }

  async getSurveyQuestions(creatorId: string, surveyId: string) {
    await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const questions = await this.getQuestionsBySurveyId(surveyId);

    return {
      surveyId,
      questions,
    };
  }

  async updateManualQuestion(
    creatorId: string,
    surveyId: string,
    questionId: string,
    dto: UpdateManualQuestionDto,
  ) {
    await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
      expectedMethod: SurveyCreationMethod.MANUAL,
    });

    const existingQuestion = await this.prisma.surveyQuestion.findUnique({
      where: {
        id: questionId,
      },
      select: {
        id: true,
        surveyId: true,
        source: true,
        type: true,
      },
    });

    if (!existingQuestion || existingQuestion.surveyId !== surveyId) {
      throw new BadRequestException('Question not found');
    }

    if (existingQuestion.source !== SurveyQuestionSource.MANUAL) {
      throw new BadRequestException('Only manual questions can be edited here');
    }

    const finalType = dto.type ?? existingQuestion.type;

    if (dto.options) {
      this.validateQuestionOptions(finalType, dto.options);
    }

    const updatedQuestion = await this.prisma.$transaction(async (tx) => {
      const question = await tx.surveyQuestion.update({
        where: {
          id: questionId,
        },
        data: {
          questionText: dto.questionText,
          type: dto.type,
          isRequired: dto.isRequired,
        },
        select: {
          id: true,
          questionText: true,
          type: true,
          source: true,
          order: true,
          isRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (dto.options) {
        await tx.surveyQuestionOption.deleteMany({
          where: {
            questionId,
          },
        });

        if (dto.options.length > 0) {
          await tx.surveyQuestionOption.createMany({
            data: dto.options.map((option, index) => ({
              questionId,
              optionText: option.optionText,
              order: index + 1,
            })),
          });
        }
      }

      const options = await tx.surveyQuestionOption.findMany({
        where: {
          questionId,
        },
        orderBy: {
          order: 'asc',
        },
        select: {
          id: true,
          optionText: true,
          order: true,
        },
      });

      return {
        ...question,
        options,
      };
    });

    return {
      message: 'Question updated successfully',
      question: updatedQuestion,
    };
  }

  async deleteQuestion(
    creatorId: string,
    surveyId: string,
    questionId: string,
  ) {
    await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const question = await this.prisma.surveyQuestion.findUnique({
      where: {
        id: questionId,
      },
      select: {
        id: true,
        surveyId: true,
      },
    });

    if (!question || question.surveyId !== surveyId) {
      throw new BadRequestException('Question not found');
    }

    await this.prisma.surveyQuestion.delete({
      where: {
        id: questionId,
      },
    });

    return {
      message: 'Question deleted successfully',
    };
  }

  async completeQuestionStep(creatorId: string, surveyId: string) {
    const survey = await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const questionCount = await this.prisma.surveyQuestion.count({
      where: {
        surveyId,
      },
    });

    if (questionCount === 0) {
      throw new BadRequestException(
        'Please add at least one question before continuing',
      );
    }

    const updatedSurvey = await this.prisma.survey.update({
      where: {
        id: survey.id,
      },
      data: {
        currentStep: SurveyCreationStep.TARGET_AUDIENCE,
      },
      select: {
        id: true,
        currentStep: true,
        creationMethod: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Question step completed successfully',
      survey: updatedSurvey,
      nextStep: 'TARGET_AUDIENCE',
    };
  }

  async setTargetAudience(
    creatorId: string,
    surveyId: string,
    dto: SetTargetAudienceDto,
  ) {
    const survey = await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const questionCount = await this.prisma.surveyQuestion.count({
      where: {
        surveyId,
      },
    });

    if (questionCount === 0) {
      throw new BadRequestException(
        'Please add questions before setting target audience',
      );
    }

    if (
      dto.minimumAge !== undefined &&
      dto.maximumAge !== undefined &&
      dto.minimumAge > dto.maximumAge
    ) {
      throw new BadRequestException(
        'Minimum age cannot be greater than maximum age',
      );
    }

    const estimatedReach = await this.estimateAudienceReach(dto);

    const targetAudience = await this.prisma.surveyTargetAudience.upsert({
      where: {
        surveyId,
      },
      create: {
        surveyId,
        minimumAge: dto.minimumAge,
        maximumAge: dto.maximumAge,
        gender: dto.gender ?? AudienceGender.ALL,
        city: dto.city,
        district: dto.district,
        educationLevel: dto.educationLevel,
        occupation: dto.occupation,
        sampleBase: dto.sampleBase,
        estimatedReach,
      },
      update: {
        minimumAge: dto.minimumAge,
        maximumAge: dto.maximumAge,
        gender: dto.gender ?? AudienceGender.ALL,
        city: dto.city,
        district: dto.district,
        educationLevel: dto.educationLevel,
        occupation: dto.occupation,
        sampleBase: dto.sampleBase,
        estimatedReach,
      },
      select: {
        id: true,
        minimumAge: true,
        maximumAge: true,
        gender: true,
        city: true,
        district: true,
        educationLevel: true,
        occupation: true,
        sampleBase: true,
        estimatedReach: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const updatedSurvey = await this.prisma.survey.update({
      where: {
        id: survey.id,
      },
      data: {
        audience: dto.sampleBase,
        currentStep: SurveyCreationStep.SAMPLE_BUDGET,
      },
      select: {
        id: true,
        title: true,
        audience: true,
        currentStep: true,
        status: true,
        creationMethod: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Target audience saved successfully',
      survey: updatedSurvey,
      targetAudience,
      nextStep: 'SAMPLE_BUDGET',
    };
  }

  private async validateEditableSurveyForCreator(params: {
    creatorId: string;
    surveyId: string;
    expectedMethod?: SurveyCreationMethod;
  }) {
    const { creatorId, surveyId, expectedMethod } = params;

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

    if (expectedMethod && survey.creationMethod !== expectedMethod) {
      throw new BadRequestException(
        `This survey is not configured for ${expectedMethod} question creation`,
      );
    }

    return survey;
  }

  private validateQuestionOptions(
    type: SurveyQuestionType,
    options: { optionText: string }[],
  ): void {
    const optionRequiredTypes: SurveyQuestionType[] = [
      SurveyQuestionType.MULTIPLE_CHOICE,
      SurveyQuestionType.SINGLE_SELECT,
      SurveyQuestionType.RATING_SCALE,
      SurveyQuestionType.YES_NO,
    ];

    const needsOptions = optionRequiredTypes.includes(type);

    if (needsOptions && options.length < 2) {
      throw new BadRequestException(
        'This question type requires at least 2 options',
      );
    }

    if (!needsOptions && options.length > 0) {
      throw new BadRequestException(
        'Short answer and long answer questions should not have options',
      );
    }
  }

  private async getQuestionsBySurveyId(surveyId: string) {
    return this.prisma.surveyQuestion.findMany({
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
        createdAt: true,
        updatedAt: true,
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
  }

  private async estimateAudienceReach(
    dto: SetTargetAudienceDto,
  ): Promise<number> {
    if (dto.sampleBase === SurveyAudienceType.VERIFIED_USERS_ONLY) {
      return this.prisma.user.count({
        where: {
          role: {
            in: [UserRole.PARTICIPANT, UserRole.BOTH],
          },
          nicImagePath: {
            not: null,
          },
          selfiePath: {
            not: null,
          },
        },
      });
    }

    return this.prisma.user.count({
      where: {
        role: {
          in: [UserRole.PARTICIPANT, UserRole.BOTH],
        },
      },
    });
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
