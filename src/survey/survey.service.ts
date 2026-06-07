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
import { SetSampleBudgetDto } from './dto/set-sample-budget.dto';
import { PublishSurveyDto } from './dto/publish-survey.dto';
import { EstimateAudienceReachQueryDto } from './dto/estimate-audience-reach-query.dto';

import { Prisma } from '../generated/prisma/client';

import {
  AudienceGender,
  RewardDistributionType,
  SurveyAudienceType,
  SurveyBudgetCurrency,
  SurveyCreationMethod,
  SurveyCreationStep,
  SurveyPublishOption,
  SurveyQuestionSource,
  SurveyQuestionType,
  SurveyResponseStatus,
  SurveyStatus,
  UserRole,
} from '../generated/prisma/enums';

type GeneratedQuestion = {
  order: number;
  questionText: string;
  type: SurveyQuestionType;
  options: string[];
  isRequired: boolean;
};

type AiQuestionServiceResponse = {
  surveyTitle?: string;
  questions?: AiQuestionServiceQuestion[];
};

type AiQuestionServiceQuestion = {
  order?: number;
  questionText?: string;
  type?: string;
  options?: unknown[];
  isRequired?: boolean;
  helpText?: string;
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
        surveyClosingTime: dto.surveyClosingTime,
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
        surveyClosingTime: true,
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
    const survey = await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const updatedSurvey = await this.prisma.survey.update({
      where: {
        id: survey.id,
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
        surveyClosingTime: true,
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

    const generatedQuestions = await this.requestAiQuestions(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.surveyQuestion.deleteMany({
        where: {
          surveyId,
          source: SurveyQuestionSource.AI_GENERATED,
        },
      });

      for (const generatedQuestion of generatedQuestions) {
        const question = await tx.surveyQuestion.create({
          data: {
            surveyId,
            questionText: generatedQuestion.questionText,
            type: generatedQuestion.type,
            source: SurveyQuestionSource.AI_GENERATED,
            order: generatedQuestion.order,
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
      surveyTitle: dto.title,
      currentStep: SurveyCreationStep.CREATE_QUESTIONS,
      questions: questions.map((question) => ({
        id: question.id,
        order: question.order,
        questionText: question.questionText,
        type: question.type,
        options: question.options.map((option) => option.optionText),
        isRequired: question.isRequired,
        source: question.source,
      })),
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

  async getSurveyAnalytics(userId: string, surveyId: string) {
    await this.validateSurveyCreatorAccess(userId, surveyId);

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        questions: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            questionText: true,
            type: true,
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
            responseAnswers: {
              where: {
                surveyResponse: {
                  status: SurveyResponseStatus.COMPLETED,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                id: true,
                answerText: true,
                selectedOptionId: true,
                selectedOptionIds: true,
                ratingValue: true,
                booleanValue: true,
                createdAt: true,
                surveyResponse: {
                  select: {
                    id: true,
                    participantId: true,
                    completedAt: true,
                    createdAt: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          where: {
            status: SurveyResponseStatus.COMPLETED,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        totalCompletedSubmissions: survey.responses.length,
      },
      questions: survey.questions.map((question) => {
        const optionSelectionCounts = new Map<string, number>();

        for (const option of question.options) {
          optionSelectionCounts.set(option.id, 0);
        }

        for (const answer of question.responseAnswers) {
          if (answer.selectedOptionId) {
            optionSelectionCounts.set(
              answer.selectedOptionId,
              (optionSelectionCounts.get(answer.selectedOptionId) ?? 0) + 1,
            );
          }

          for (const optionId of answer.selectedOptionIds) {
            optionSelectionCounts.set(
              optionId,
              (optionSelectionCounts.get(optionId) ?? 0) + 1,
            );
          }
        }

        return {
          questionId: question.id,
          question: question.questionText,
          questionType: question.type,
          order: question.order,
          isRequired: question.isRequired,
          totalAnswers: question.responseAnswers.length,
          options: question.options.map((option) => ({
            id: option.id,
            optionText: option.optionText,
            order: option.order,
            selectionCount: optionSelectionCounts.get(option.id) ?? 0,
          })),
          answers: question.responseAnswers.map((answer) => ({
            answerId: answer.id,
            submissionId: answer.surveyResponse.id,
            participantId: answer.surveyResponse.participantId,
            submittedAt:
              answer.surveyResponse.completedAt ??
              answer.surveyResponse.createdAt ??
              answer.createdAt,
            answerText: answer.answerText,
            selectedOptionId: answer.selectedOptionId,
            selectedOptionIds: answer.selectedOptionIds,
            ratingValue: answer.ratingValue,
            booleanValue: answer.booleanValue,
          })),
        };
      }),
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

  async setSampleBudget(
    creatorId: string,
    surveyId: string,
    dto: SetSampleBudgetDto,
  ) {
    const survey = await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const targetAudience = await this.prisma.surveyTargetAudience.findUnique({
      where: {
        surveyId,
      },
      select: {
        id: true,
      },
    });

    if (!targetAudience) {
      throw new BadRequestException(
        'Please set target audience before setting sample size and budget',
      );
    }

    if (dto.requiredResponses <= 0) {
      throw new BadRequestException(
        'Required responses must be greater than 0',
      );
    }

    if (dto.totalBudget <= 0) {
      throw new BadRequestException('Total budget must be greater than 0');
    }

    const platformCommissionAmount =
      (dto.totalBudget * dto.platformCommissionPercentage) / 100;

    const participantRewardBudget = dto.totalBudget - platformCommissionAmount;

    if (participantRewardBudget <= 0) {
      throw new BadRequestException(
        'Participant reward budget must be greater than 0',
      );
    }

    const rewardPerParticipant =
      participantRewardBudget / dto.requiredResponses;

    const rewardDistribution =
      dto.rewardDistribution ?? RewardDistributionType.EQUAL_PER_PARTICIPANT;

    const currency = dto.currency ?? SurveyBudgetCurrency.LKR;

    const sampleBudget = await this.prisma.surveySampleBudget.upsert({
      where: {
        surveyId,
      },
      create: {
        surveyId,
        requiredResponses: dto.requiredResponses,
        totalBudget: new Prisma.Decimal(dto.totalBudget),
        platformCommissionPercentage: new Prisma.Decimal(
          dto.platformCommissionPercentage,
        ),
        platformCommissionAmount: new Prisma.Decimal(platformCommissionAmount),
        participantRewardBudget: new Prisma.Decimal(participantRewardBudget),
        rewardPerParticipant: new Prisma.Decimal(rewardPerParticipant),
        rewardDistribution,
        currency,
        budgetNotes: dto.budgetNotes,
      },
      update: {
        requiredResponses: dto.requiredResponses,
        totalBudget: new Prisma.Decimal(dto.totalBudget),
        platformCommissionPercentage: new Prisma.Decimal(
          dto.platformCommissionPercentage,
        ),
        platformCommissionAmount: new Prisma.Decimal(platformCommissionAmount),
        participantRewardBudget: new Prisma.Decimal(participantRewardBudget),
        rewardPerParticipant: new Prisma.Decimal(rewardPerParticipant),
        rewardDistribution,
        currency,
        budgetNotes: dto.budgetNotes,
      },
      select: {
        id: true,
        requiredResponses: true,
        totalBudget: true,
        platformCommissionPercentage: true,
        platformCommissionAmount: true,
        participantRewardBudget: true,
        rewardPerParticipant: true,
        rewardDistribution: true,
        currency: true,
        budgetNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const updatedSurvey = await this.prisma.survey.update({
      where: {
        id: survey.id,
      },
      data: {
        currentStep: SurveyCreationStep.PREVIEW_SUBMIT,
      },
      select: {
        id: true,
        title: true,
        currentStep: true,
        status: true,
        creationMethod: true,
        audience: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Sample size and budget saved successfully',
      survey: updatedSurvey,
      sampleBudget,
      budgetBreakdown: {
        totalBudget: dto.totalBudget,
        platformCommissionPercentage: dto.platformCommissionPercentage,
        platformCommissionAmount,
        participantRewardBudget,
        requiredResponses: dto.requiredResponses,
        rewardPerParticipant,
        currency,
      },
      nextStep: 'PREVIEW_SUBMIT',
    };
  }

  async getEstimatedReach(
    userId: string,
    surveyId: string,
    query: EstimateAudienceReachQueryDto,
  ) {
    if (
      query.minimumAge !== undefined &&
      query.maximumAge !== undefined &&
      query.minimumAge > query.maximumAge
    ) {
      throw new BadRequestException(
        'Minimum age cannot be greater than maximum age',
      );
    }

    await this.validateSurveyCreatorAccess(userId, surveyId);

    const estimatedReach = await this.estimateAudienceReach(query);

    return {
      surveyId,
      estimatedReach,
      targetAudience: {
        minimumAge: query.minimumAge ?? null,
        maximumAge: query.maximumAge ?? null,
        gender: query.gender ?? AudienceGender.ALL,
        city: query.city ?? null,
        district: query.district ?? null,
        educationLevel: query.educationLevel ?? null,
        occupation: query.occupation ?? null,
        sampleBase: query.sampleBase,
      },
      calculatedAt: new Date(),
    };
  }

  async getSurveyPreview(creatorId: string, surveyId: string) {
    await this.validateEditableSurveyForCreator({
      creatorId,
      surveyId,
    });

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        creatorId: true,
        title: true,
        description: true,
        category: true,
        audience: true,
        status: true,
        currentStep: true,
        creationMethod: true,
        estimatedCompletionDays: true,
        createdAt: true,
        updatedAt: true,

        questions: {
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
        },

        targetAudience: {
          select: {
            minimumAge: true,
            maximumAge: true,
            gender: true,
            city: true,
            district: true,
            educationLevel: true,
            occupation: true,
            sampleBase: true,
          },
        },

        sampleBudget: {
          select: {
            requiredResponses: true,
            totalBudget: true,
            platformCommissionPercentage: true,
            platformCommissionAmount: true,
            participantRewardBudget: true,
            rewardPerParticipant: true,
            rewardDistribution: true,
            currency: true,
            budgetNotes: true,
          },
        },
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    const readiness = this.getSurveyReadinessChecklist(survey);

    return {
      survey,
      readiness,
      canPublish: Object.values(readiness).every(Boolean),
    };
  }

  async publishSurvey(
    creatorId: string,
    surveyId: string,
    dto: PublishSurveyDto,
  ) {
    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        creatorId: true,
        status: true,
        title: true,
        description: true,
        creationMethod: true,
        questions: {
          select: {
            id: true,
          },
        },
        targetAudience: {
          select: {
            id: true,
          },
        },
        sampleBudget: {
          select: {
            id: true,
            rewardPerParticipant: true,
          },
        },
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    if (survey.creatorId !== creatorId) {
      throw new ForbiddenException('You cannot publish this survey');
    }

    if (survey.status !== SurveyStatus.DRAFT) {
      throw new BadRequestException('Only draft surveys can be published');
    }

    const readiness = this.getSurveyReadinessChecklist(survey);

    if (!Object.values(readiness).every(Boolean)) {
      throw new BadRequestException({
        message: 'Survey is not ready to publish',
        readiness,
      });
    }

    if (dto.publishOption === SurveyPublishOption.SAVE_DRAFT) {
      const updatedSurvey = await this.prisma.survey.update({
        where: {
          id: surveyId,
        },
        data: {
          status: SurveyStatus.DRAFT,
          currentStep: SurveyCreationStep.PREVIEW_SUBMIT,
        },
        select: {
          id: true,
          title: true,
          status: true,
          currentStep: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Survey saved as draft',
        survey: updatedSurvey,
        readiness,
      };
    }

    if (dto.publishOption === SurveyPublishOption.SCHEDULE) {
      if (!dto.scheduledPublishAt) {
        throw new BadRequestException('scheduledPublishAt is required');
      }

      const scheduledDate = new Date(dto.scheduledPublishAt);

      if (scheduledDate <= new Date()) {
        throw new BadRequestException(
          'Scheduled publish date must be in the future',
        );
      }

      const updatedSurvey = await this.prisma.survey.update({
        where: {
          id: surveyId,
        },
        data: {
          status: SurveyStatus.DRAFT,
          currentStep: SurveyCreationStep.COMPLETED,
          scheduledPublishAt: scheduledDate,
        },
        select: {
          id: true,
          title: true,
          status: true,
          currentStep: true,
          scheduledPublishAt: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Survey scheduled successfully',
        survey: updatedSurvey,
        readiness,
        nextStep: 'SCHEDULED',
      };
    }

    const updatedSurvey = await this.prisma.survey.update({
      where: {
        id: surveyId,
      },
      data: {
        status: SurveyStatus.ACTIVE,
        currentStep: SurveyCreationStep.COMPLETED,
        publishedAt: new Date(),
        scheduledPublishAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        currentStep: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: creatorId,
        title: `Survey "${updatedSurvey.title}" has been published`,
        message:
          'Your survey is now active and available to matched participants.',
        type: 'SURVEY',
      },
    });

    return {
      message: 'Survey published successfully',
      survey: updatedSurvey,
      readiness,
      nextStep: 'PUBLISHED',
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

    if (
      expectedMethod === SurveyCreationMethod.AI_ASSISTED &&
      survey.creationMethod !== expectedMethod
    ) {
      throw new BadRequestException(
        `This survey is not configured for ${expectedMethod} question creation`,
      );
    }

    return survey;
  }

  private async validateSurveyCreatorAccess(userId: string, surveyId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (!surveyId) {
      throw new BadRequestException('surveyId is required');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role !== UserRole.CREATOR && user.role !== UserRole.BOTH) {
      throw new ForbiddenException('Only creators can access this survey');
    }

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        creatorId: true,
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    if (survey.creatorId !== userId) {
      throw new ForbiddenException('You cannot access this survey');
    }

    return survey;
  }

  private getSurveyReadinessChecklist(survey: {
    title?: string | null;
    description?: string | null;
    creationMethod?: SurveyCreationMethod | null;
    questions?: unknown[];
    targetAudience?: object | null;
    sampleBudget?: {
      rewardPerParticipant?: object | string | number | null;
    } | null;
  }) {
    return {
      basicDetailsCompleted: Boolean(survey.title && survey.description),
      surveyMethodSelected: Boolean(survey.creationMethod),
      questionsAddedSuccessfully: Boolean(
        survey.questions && survey.questions.length > 0,
      ),
      targetAudienceDefined: Boolean(survey.targetAudience),
      budgetConfigured: Boolean(survey.sampleBudget),
      rewardPerParticipantCalculated: Boolean(
        survey.sampleBudget?.rewardPerParticipant,
      ),
    };
  }

  private validateQuestionOptions(
    type: SurveyQuestionType,
    options: { optionText: string }[],
  ): void {
    const optionRequiredTypes: SurveyQuestionType[] = [
      SurveyQuestionType.MULTIPLE_CHOICE,
      SurveyQuestionType.SINGLE_SELECT,
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
        'Only multiple choice, single select, and yes/no questions should have options',
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
    dto: Pick<
      EstimateAudienceReachQueryDto,
      | 'minimumAge'
      | 'maximumAge'
      | 'gender'
      | 'city'
      | 'district'
      | 'educationLevel'
      | 'occupation'
      | 'sampleBase'
    >,
  ): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: {
          in: [UserRole.PARTICIPANT, UserRole.BOTH],
        },
        ...(dto.sampleBase === SurveyAudienceType.VERIFIED_USERS_ONLY
          ? {
              isIdentityVerified: true,
            }
          : {}),
        ...(dto.minimumAge !== undefined
          ? {
              participantAge: {
                gte: dto.minimumAge,
              },
            }
          : {}),
        ...(dto.maximumAge !== undefined
          ? {
              participantAge: {
                ...(dto.minimumAge !== undefined
                  ? { gte: dto.minimumAge }
                  : {}),
                lte: dto.maximumAge,
              },
            }
          : {}),
        ...(dto.gender && dto.gender !== AudienceGender.ALL
          ? {
              participantGender: dto.gender,
            }
          : {}),
        ...(dto.city
          ? {
              participantCity: {
                equals: dto.city,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(dto.district
          ? {
              participantDistrict: {
                equals: dto.district,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(dto.educationLevel
          ? {
              participantEducationLevel: {
                equals: dto.educationLevel,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(dto.occupation
          ? {
              participantOccupation: {
                equals: dto.occupation,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
    });
  }

  private async requestAiQuestions(
    dto: GenerateAiQuestionsDto,
  ): Promise<GeneratedQuestion[]> {
    const baseUrl =
      process.env.AI_QUESTION_SERVICE_BASE_URL ?? 'http://127.0.0.1:8000';
    const apiKey = process.env.FASTAPI_API_KEY;
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/ai/questions/generate`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        title: dto.title,
        description: dto.description,
        maxNumberOfQuestions: dto.maxNumberOfQuestions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new BadRequestException(
        `AI question generation failed with status ${response.status}: ${errorText}`,
      );
    }

    const result = (await response.json()) as AiQuestionServiceResponse;

    return this.normalizeAiGeneratedQuestions(result, dto.maxNumberOfQuestions);
  }

  private normalizeAiGeneratedQuestions(
    response: AiQuestionServiceResponse,
    maxNumberOfQuestions: number,
  ): GeneratedQuestion[] {
    const rawQuestions = Array.isArray(response.questions)
      ? response.questions
      : [];

    const normalizedQuestions = rawQuestions
      .map((question, index) => this.normalizeSingleAiQuestion(question, index))
      .filter((question): question is GeneratedQuestion => question !== null)
      .slice(0, maxNumberOfQuestions);

    if (normalizedQuestions.length === 0) {
      throw new BadRequestException(
        'AI question generation returned no usable questions',
      );
    }

    return normalizedQuestions.map((question, index) => ({
      ...question,
      order: index + 1,
    }));
  }

  private normalizeSingleAiQuestion(
    question: AiQuestionServiceQuestion,
    fallbackIndex: number,
  ): GeneratedQuestion | null {
    const questionText = question?.questionText?.trim();

    if (!questionText) {
      return null;
    }

    const type = this.normalizeAiQuestionType(question.type, question.options);
    const isRequired = question.isRequired ?? true;
    const options = this.normalizeAiQuestionOptions(type, question.options);

    return {
      order:
        typeof question.order === 'number' && question.order > 0
          ? question.order
          : fallbackIndex + 1,
      questionText,
      type,
      options,
      isRequired,
    };
  }

  private normalizeAiQuestionType(
    rawType: string | undefined,
    rawOptions: unknown[] | undefined,
  ): SurveyQuestionType {
    const normalizedType = rawType?.trim().toUpperCase();
    const supportedTypes = new Set<string>(Object.values(SurveyQuestionType));

    if (normalizedType && supportedTypes.has(normalizedType)) {
      return normalizedType as SurveyQuestionType;
    }

    const options = Array.isArray(rawOptions)
      ? rawOptions
          .map((option) => (typeof option === 'string' ? option.trim() : ''))
          .filter((option) => option.length > 0)
      : [];

    if (options.length === 2) {
      const yesNoOptions = options.map((option) => option.toLowerCase());
      if (yesNoOptions.includes('yes') && yesNoOptions.includes('no')) {
        return SurveyQuestionType.YES_NO;
      }
    }

    if (options.length >= 2) {
      return SurveyQuestionType.SINGLE_SELECT;
    }

    return SurveyQuestionType.SHORT_ANSWER;
  }

  private normalizeAiQuestionOptions(
    type: SurveyQuestionType,
    rawOptions: unknown[] | undefined,
  ): string[] {
    const options = Array.isArray(rawOptions)
      ? [
          ...new Set(
            rawOptions
              .map((option) =>
                typeof option === 'string' ? option.trim() : '',
              )
              .filter((option) => option.length > 0),
          ),
        ]
      : [];

    if (type === SurveyQuestionType.RATING_SCALE) {
      return options.length >= 2 ? options : ['1', '2', '3', '4', '5'];
    }

    if (type === SurveyQuestionType.YES_NO) {
      return ['Yes', 'No'];
    }

    if (
      type === SurveyQuestionType.MULTIPLE_CHOICE ||
      type === SurveyQuestionType.SINGLE_SELECT
    ) {
      if (options.length >= 2) {
        return options;
      }

      return ['Option 1', 'Option 2'];
    }

    return [];
  }
}
