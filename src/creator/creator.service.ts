import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { CreatorDashboardResponse } from './types/dashboard.types';
import { CreatorSurveysResponse } from './types/survey-list.types';
import { Prisma } from '../generated/prisma/client';
import {
  RewardStatus,
  SurveyResponseStatus,
  SurveyStatus,
  WalletTransactionStatus,
} from '../generated/prisma/enums';

type SubmissionReviewTarget = {
  id: string;
  surveyId: string;
  participantId: string | null;
  status: SurveyResponseStatus;
  rewardStatus: RewardStatus;
  rewardAmount: Prisma.Decimal | null;
};

type ReviewedSubmissionResult = {
  id: string;
  surveyId: string;
  participantId: string | null;
  status: SurveyResponseStatus;
  rewardStatus: RewardStatus;
  rewardAmount: Prisma.Decimal | null;
  completedAt: Date | null;
};

@Injectable()
export class CreatorService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(creatorId: string): Promise<CreatorDashboardResponse> {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    const creator = await this.prisma.user.findUnique({
      where: {
        id: creatorId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        profileImagePath: true,
        isEmailVerified: true,
      },
    });

    if (!creator) {
      throw new BadRequestException('Creator not found');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'BOTH') {
      throw new BadRequestException('Only creators can access this dashboard');
    }

    const [
      totalSurveys,
      activeSurveys,
      draftSurveys,
      closedSurveys,
      archivedSurveys,
      totalResponses,
      recentSurveys,
      notifications,
      responseGrowth,
    ] = await Promise.all([
      this.prisma.survey.count({
        where: {
          creatorId,
        },
      }),

      this.prisma.survey.count({
        where: {
          creatorId,
          status: 'ACTIVE',
        },
      }),

      this.prisma.survey.count({
        where: {
          creatorId,
          status: 'DRAFT',
        },
      }),

      this.prisma.survey.count({
        where: {
          creatorId,
          status: 'CLOSED',
        },
      }),

      this.prisma.survey.count({
        where: {
          creatorId,
          status: 'ARCHIVED',
        },
      }),

      this.prisma.surveyResponse.count({
        where: {
          survey: {
            creatorId,
          },
        },
      }),

      this.prisma.survey.findMany({
        where: {
          creatorId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          category: true,
          updatedAt: true,
          responses: {
            select: {
              id: true,
            },
          },
        },
      }),

      this.prisma.notification.findMany({
        where: {
          userId: creatorId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          isRead: true,
          createdAt: true,
        },
      }),

      this.getResponseGrowth(creatorId),
    ]);

    const creatorProgress = this.getCreatorProgress({
      profileImagePath: creator.profileImagePath,
      isEmailVerified: creator.isEmailVerified,
      totalSurveys,
      totalResponses,
    });

    return {
      welcome: {
        username: creator.username,
        activeSurveys,
        totalResponses,
      },

      summaryCards: {
        totalSurveys,
        activeSurveys,
        totalResponses,
      },

      responseGrowth,

      surveyStatus: {
        active: activeSurveys,
        draft: draftSurveys,
        closed: closedSurveys,
        archived: archivedSurveys,
      },

      notifications,

      creatorProgress,

      recentSurveys: recentSurveys.map((survey) => ({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        category: survey.category,
        responseCount: survey.responses.length,
        updatedAt: survey.updatedAt,
      })),
    };
  }

  async getSurveys(
    creatorId: string,
    status?: SurveyStatus,
    limit = 10,
  ): Promise<CreatorSurveysResponse> {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, role: true },
    });

    if (!creator) {
      throw new BadRequestException('Creator not found');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'BOTH') {
      throw new BadRequestException('Only creators can access this resource');
    }

    const where: Prisma.SurveyWhereInput = { creatorId };

    if (status) {
      where.status = status;
    }

    const surveys = await this.prisma.survey.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        responses: {
          select: { id: true },
        },
      },
    });

    return {
      total: surveys.length,
      surveys: surveys.map((survey) => ({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        category: survey.category,
        responseCount: survey.responses.length,
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt,
      })),
    };
  }

  async getSurveySubmissions(
    creatorId: string,
    surveyId: string,
    page = 1,
    limit = 10,
  ) {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    if (!surveyId) {
      throw new BadRequestException('surveyId is required');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, role: true },
    });

    if (!creator) {
      throw new BadRequestException('Creator not found');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'BOTH') {
      throw new BadRequestException('Only creators can access this resource');
    }

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        title: true,
        creatorId: true,
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    if (survey.creatorId !== creatorId) {
      throw new BadRequestException(
        'You cannot access submissions for this survey',
      );
    }

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const [total, submissions] = await Promise.all([
      this.prisma.surveyResponse.count({
        where: {
          surveyId,
        },
      }),
      this.prisma.surveyResponse.findMany({
        where: {
          surveyId,
        },
        orderBy: {
          completedAt: 'asc',
        },
        skip,
        take: safeLimit,
        select: {
          id: true,
          rewardStatus: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
    ]);

    const rows = submissions.map((submission, index) => {
      const submittedTime =
        submission.completedAt ?? submission.createdAt ?? submission.startedAt;
      const submissionNumber = skip + index + 1;

      return {
        submissionId: submission.id,
        submissionNumber,
        submittedAt: submittedTime,
        status: submission.rewardStatus,
      };
    });

    return {
      survey: {
        id: survey.id,
        title: survey.title,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        showingFrom: total === 0 ? 0 : skip + 1,
        showingTo: Math.min(skip + safeLimit, total),
      },
      submissions: rows,
    };
  }

  async getSingleSubmission(
    creatorId: string,
    surveyId: string,
    submissionId: string,
  ) {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    if (!surveyId) {
      throw new BadRequestException('surveyId is required');
    }

    if (!submissionId) {
      throw new BadRequestException('submissionId is required');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, role: true },
    });

    if (!creator) {
      throw new BadRequestException('Creator not found');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'BOTH') {
      throw new BadRequestException('Only creators can access this resource');
    }

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        title: true,
        creatorId: true,
      },
    });

    if (!survey) {
      throw new BadRequestException('Survey not found');
    }

    if (survey.creatorId !== creatorId) {
      throw new BadRequestException(
        'You cannot access submissions for this survey',
      );
    }

    const submission = await this.prisma.surveyResponse.findUnique({
      where: {
        id: submissionId,
      },
      select: {
        id: true,
        surveyId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        participant: {
          select: {
            id: true,
            username: true,
            email: true,
            isIdentityVerified: true,
          },
        },
        answers: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            questionType: true,
            answerText: true,
            selectedOptionId: true,
            selectedOptionIds: true,
            ratingValue: true,
            booleanValue: true,
            question: {
              select: {
                id: true,
                questionText: true,
                type: true,
                order: true,
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
          },
        },
      },
    });

    if (!submission || submission.surveyId !== surveyId) {
      throw new BadRequestException('Submission not found for this survey');
    }

    return {
      survey: {
        id: survey.id,
        title: survey.title,
      },
      submission: {
        id: submission.id,
        submittedAt:
          submission.completedAt ??
          submission.createdAt ??
          submission.startedAt,
        status: submission.status,
        isAccepted:
          submission.status === SurveyResponseStatus.COMPLETED
            ? true
            : submission.status === SurveyResponseStatus.REJECTED
              ? false
              : null,
      },
      participant: {
        id: submission.participant?.id ?? null,
        username: submission.participant?.username ?? null,
        email: submission.participant?.email ?? null,
        verificationStatus: submission.participant?.isIdentityVerified
          ? 'VERIFIED'
          : 'NOT_VERIFIED',
        isIdentityVerified: submission.participant?.isIdentityVerified ?? false,
      },
      answers: submission.answers.map((answer) => ({
        answerId: answer.id,
        questionId: answer.question.id,
        questionText: answer.question.questionText,
        questionOrder: answer.question.order,
        questionType: answer.question.type,
        answerType: answer.questionType,
        answer: {
          answerText: answer.answerText,
          selectedOptionId: answer.selectedOptionId,
          selectedOptionIds: answer.selectedOptionIds,
          ratingValue: answer.ratingValue,
          booleanValue: answer.booleanValue,
        },
        options: answer.question.options,
      })),
    };
  }

  async acceptSubmission(
    creatorId: string,
    surveyId: string,
    submissionId: string,
  ) {
    const submission = await this.getSubmissionForCreatorReview(
      creatorId,
      surveyId,
      submissionId,
    );

    if (submission.rewardStatus === RewardStatus.RELEASED) {
      throw new BadRequestException(
        'This submission has already been accepted',
      );
    }

    if (
      submission.status === SurveyResponseStatus.REJECTED ||
      submission.rewardStatus === RewardStatus.REJECTED
    ) {
      throw new BadRequestException(
        'This submission has already been rejected',
      );
    }

    const rewardAmount = this.toNumber(submission.rewardAmount);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSubmission = await tx.surveyResponse.update({
        where: {
          id: submission.id,
        },
        data: {
          status: SurveyResponseStatus.COMPLETED,
          rewardStatus: RewardStatus.RELEASED,
        },
        select: {
          id: true,
          surveyId: true,
          participantId: true,
          status: true,
          rewardStatus: true,
          rewardAmount: true,
          completedAt: true,
        },
      });

      if (submission.participantId && rewardAmount > 0) {
        await tx.participantWallet.update({
          where: {
            userId: submission.participantId,
          },
          data: {
            pendingRewards: {
              decrement: rewardAmount,
            },
            balance: {
              increment: rewardAmount,
            },
          },
        });

        await tx.walletTransaction.updateMany({
          where: {
            surveyResponseId: submission.id,
          },
          data: {
            status: WalletTransactionStatus.COMPLETED,
          },
        });
      }

      return updatedSubmission;
    });

    return {
      message: 'Submission accepted successfully',
      submission: {
        id: result.id,
        surveyId: result.surveyId,
        participantId: result.participantId,
        status: result.status,
        rewardStatus: result.rewardStatus,
        rewardAmount: this.toNumber(result.rewardAmount),
        completedAt: result.completedAt,
      },
    };
  }

  async rejectSubmission(
    creatorId: string,
    surveyId: string,
    submissionId: string,
  ) {
    const submission = await this.getSubmissionForCreatorReview(
      creatorId,
      surveyId,
      submissionId,
    );

    if (submission.status === SurveyResponseStatus.REJECTED) {
      throw new BadRequestException(
        'This submission has already been rejected',
      );
    }

    if (submission.rewardStatus === RewardStatus.REJECTED) {
      throw new BadRequestException(
        'This submission has already been rejected',
      );
    }

    if (submission.rewardStatus === RewardStatus.RELEASED) {
      throw new BadRequestException(
        'This submission has already been accepted and released',
      );
    }

    const rewardAmount = this.toNumber(submission.rewardAmount);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSubmission = await tx.surveyResponse.update({
        where: {
          id: submission.id,
        },
        data: {
          status: SurveyResponseStatus.REJECTED,
          rewardStatus: RewardStatus.REJECTED,
        },
        select: {
          id: true,
          surveyId: true,
          participantId: true,
          status: true,
          rewardStatus: true,
          rewardAmount: true,
          completedAt: true,
        },
      });

      if (submission.participantId && rewardAmount > 0) {
        await tx.participantWallet.update({
          where: {
            userId: submission.participantId,
          },
          data: {
            pendingRewards: {
              decrement: rewardAmount,
            },
            totalEarned: {
              decrement: rewardAmount,
            },
          },
        });

        await tx.walletTransaction.updateMany({
          where: {
            surveyResponseId: submission.id,
          },
          data: {
            status: WalletTransactionStatus.FAILED,
          },
        });
      }

      return updatedSubmission;
    });

    return {
      message: 'Submission rejected successfully',
      submission: {
        id: result.id,
        surveyId: result.surveyId,
        participantId: result.participantId,
        status: result.status,
        rewardStatus: result.rewardStatus,
        rewardAmount: this.toNumber(result.rewardAmount),
        completedAt: result.completedAt,
      },
    };
  }

  async bulkAcceptSubmissions(
    creatorId: string,
    surveyId: string,
    submissionIds: string[],
  ) {
    const submissions = await this.getSubmissionsForCreatorReview(
      creatorId,
      surveyId,
      submissionIds,
    );

    const results = await this.prisma.$transaction(async (tx) => {
      const updatedSubmissions: ReviewedSubmissionResult[] = [];

      for (const submission of submissions) {
        updatedSubmissions.push(
          await this.applySubmissionAcceptance(tx, submission),
        );
      }

      return updatedSubmissions;
    });

    return {
      message: 'Submissions accepted successfully',
      totalProcessed: results.length,
      submissions: results.map((result) => ({
        id: result.id,
        surveyId: result.surveyId,
        participantId: result.participantId,
        status: result.status,
        rewardStatus: result.rewardStatus,
        rewardAmount: this.toNumber(result.rewardAmount),
        completedAt: result.completedAt,
      })),
    };
  }

  async bulkRejectSubmissions(
    creatorId: string,
    surveyId: string,
    submissionIds: string[],
  ) {
    const submissions = await this.getSubmissionsForCreatorReview(
      creatorId,
      surveyId,
      submissionIds,
    );

    const results = await this.prisma.$transaction(async (tx) => {
      const updatedSubmissions: ReviewedSubmissionResult[] = [];

      for (const submission of submissions) {
        updatedSubmissions.push(
          await this.applySubmissionRejection(tx, submission),
        );
      }

      return updatedSubmissions;
    });

    return {
      message: 'Submissions rejected successfully',
      totalProcessed: results.length,
      submissions: results.map((result) => ({
        id: result.id,
        surveyId: result.surveyId,
        participantId: result.participantId,
        status: result.status,
        rewardStatus: result.rewardStatus,
        rewardAmount: this.toNumber(result.rewardAmount),
        completedAt: result.completedAt,
      })),
    };
  }

  private async getResponseGrowth(
    creatorId: string,
  ): Promise<{ date: string; responses: number }[]> {
    const today = new Date();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const responses = await this.prisma.surveyResponse.findMany({
      where: {
        survey: {
          creatorId,
        },
        createdAt: {
          gte: thirtyDaysAgo,
          lte: today,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const responseMap = new Map<string, number>();

    for (let i = 0; i < 30; i += 1) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(thirtyDaysAgo.getDate() + i);

      const key = date.toISOString().split('T')[0];

      if (key) {
        responseMap.set(key, 0);
      }
    }

    for (const response of responses) {
      const key = response.createdAt.toISOString().split('T')[0];

      if (key) {
        responseMap.set(key, (responseMap.get(key) ?? 0) + 1);
      }
    }

    return Array.from(responseMap.entries()).map(([date, responsesCount]) => ({
      date,
      responses: responsesCount,
    }));
  }

  private getCreatorProgress(params: {
    profileImagePath: string | null;
    isEmailVerified: boolean;
    totalSurveys: number;
    totalResponses: number;
  }): CreatorDashboardResponse['creatorProgress'] {
    const hasProfilePicture = Boolean(params.profileImagePath);
    const hasVerifiedEmail = params.isEmailVerified;
    const hasCreatedSurvey = params.totalSurveys > 0;
    const hasTenResponses = params.totalResponses >= 10;

    const hasInvitedTeamMembers = false;

    const items = {
      addProfilePicture: hasProfilePicture,
      verifyEmailAddress: hasVerifiedEmail,
      createFirstSurvey: hasCreatedSurvey,
      get10Responses: hasTenResponses,
      inviteTeamMembers: hasInvitedTeamMembers,
    };

    const completedCount = Object.values(items).filter(Boolean).length;
    const totalCount = Object.values(items).length;

    return {
      percentage: Math.round((completedCount / totalCount) * 100),
      items,
    };
  }

  private async getSubmissionForCreatorReview(
    creatorId: string,
    surveyId: string,
    submissionId: string,
  ) {
    if (!creatorId) {
      throw new BadRequestException('creatorId is required');
    }

    if (!surveyId) {
      throw new BadRequestException('surveyId is required');
    }

    if (!submissionId) {
      throw new BadRequestException('submissionId is required');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, role: true },
    });

    if (!creator) {
      throw new BadRequestException('Creator not found');
    }

    if (creator.role !== 'CREATOR' && creator.role !== 'BOTH') {
      throw new BadRequestException('Only creators can access this resource');
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

    if (survey.creatorId !== creatorId) {
      throw new BadRequestException(
        'You cannot access submissions for this survey',
      );
    }

    const submission = await this.prisma.surveyResponse.findUnique({
      where: {
        id: submissionId,
      },
      select: {
        id: true,
        surveyId: true,
        participantId: true,
        status: true,
        rewardStatus: true,
        rewardAmount: true,
      },
    });

    if (!submission || submission.surveyId !== surveyId) {
      throw new BadRequestException('Submission not found for this survey');
    }

    return submission;
  }

  private async getSubmissionsForCreatorReview(
    creatorId: string,
    surveyId: string,
    submissionIds: string[],
  ): Promise<SubmissionReviewTarget[]> {
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      throw new BadRequestException('At least one submissionId is required');
    }

    const uniqueSubmissionIds = [...new Set(submissionIds)];

    const firstSubmission = await this.getSubmissionForCreatorReview(
      creatorId,
      surveyId,
      uniqueSubmissionIds[0]!,
    );

    const remainingSubmissionIds = uniqueSubmissionIds.slice(1);

    if (remainingSubmissionIds.length === 0) {
      return [firstSubmission];
    }

    const remainingSubmissions = await this.prisma.surveyResponse.findMany({
      where: {
        id: {
          in: remainingSubmissionIds,
        },
        surveyId,
      },
      select: {
        id: true,
        surveyId: true,
        participantId: true,
        status: true,
        rewardStatus: true,
        rewardAmount: true,
      },
    });

    if (remainingSubmissions.length !== remainingSubmissionIds.length) {
      throw new BadRequestException(
        'One or more submissions were not found for this survey',
      );
    }

    const submissionMap = new Map(
      [firstSubmission, ...remainingSubmissions].map((submission) => [
        submission.id,
        submission,
      ]),
    );

    return uniqueSubmissionIds.map((submissionId) => {
      const submission = submissionMap.get(submissionId);

      if (!submission) {
        throw new BadRequestException(
          `Submission "${submissionId}" not found for this survey`,
        );
      }

      return submission;
    });
  }

  private async applySubmissionAcceptance(
    tx: Prisma.TransactionClient,
    submission: SubmissionReviewTarget,
  ): Promise<ReviewedSubmissionResult> {
    if (submission.rewardStatus === RewardStatus.RELEASED) {
      throw new BadRequestException(
        `Submission "${submission.id}" has already been accepted`,
      );
    }

    if (
      submission.status === SurveyResponseStatus.REJECTED ||
      submission.rewardStatus === RewardStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Submission "${submission.id}" has already been rejected`,
      );
    }

    const rewardAmount = this.toNumber(submission.rewardAmount);

    const updatedSubmission = await tx.surveyResponse.update({
      where: {
        id: submission.id,
      },
      data: {
        status: SurveyResponseStatus.COMPLETED,
        rewardStatus: RewardStatus.RELEASED,
      },
      select: {
        id: true,
        surveyId: true,
        participantId: true,
        status: true,
        rewardStatus: true,
        rewardAmount: true,
        completedAt: true,
      },
    });

    if (submission.participantId && rewardAmount > 0) {
      await tx.participantWallet.update({
        where: {
          userId: submission.participantId,
        },
        data: {
          pendingRewards: {
            decrement: rewardAmount,
          },
          balance: {
            increment: rewardAmount,
          },
        },
      });

      await tx.walletTransaction.updateMany({
        where: {
          surveyResponseId: submission.id,
        },
        data: {
          status: WalletTransactionStatus.COMPLETED,
        },
      });
    }

    return updatedSubmission;
  }

  private async applySubmissionRejection(
    tx: Prisma.TransactionClient,
    submission: SubmissionReviewTarget,
  ): Promise<ReviewedSubmissionResult> {
    if (
      submission.status === SurveyResponseStatus.REJECTED ||
      submission.rewardStatus === RewardStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Submission "${submission.id}" has already been rejected`,
      );
    }

    if (submission.rewardStatus === RewardStatus.RELEASED) {
      throw new BadRequestException(
        `Submission "${submission.id}" has already been accepted and released`,
      );
    }

    const rewardAmount = this.toNumber(submission.rewardAmount);

    const updatedSubmission = await tx.surveyResponse.update({
      where: {
        id: submission.id,
      },
      data: {
        status: SurveyResponseStatus.REJECTED,
        rewardStatus: RewardStatus.REJECTED,
      },
      select: {
        id: true,
        surveyId: true,
        participantId: true,
        status: true,
        rewardStatus: true,
        rewardAmount: true,
        completedAt: true,
      },
    });

    if (submission.participantId && rewardAmount > 0) {
      await tx.participantWallet.update({
        where: {
          userId: submission.participantId,
        },
        data: {
          pendingRewards: {
            decrement: rewardAmount,
          },
          totalEarned: {
            decrement: rewardAmount,
          },
        },
      });

      await tx.walletTransaction.updateMany({
        where: {
          surveyResponseId: submission.id,
        },
        data: {
          status: WalletTransactionStatus.FAILED,
        },
      });
    }

    return updatedSubmission;
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'toNumber' in value &&
      typeof (value as { toNumber?: unknown }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }

    return 0;
  }
}
