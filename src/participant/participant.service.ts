import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import {
  RewardStatus,
  SurveyAudienceType,
  SurveyResponseStatus,
  SurveyStatus,
  UserRole,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../generated/prisma/enums';

@Injectable()
export class ParticipantService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(participantId: string) {
    if (!participantId) {
      throw new BadRequestException('participantId is required');
    }

    const participant = await this.prisma.user.findUnique({
      where: {
        id: participantId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        nicImagePath: true,
        selfiePath: true,
        participantAge: true,
        participantGender: true,
        participantCity: true,
        participantDistrict: true,
        participantEducationLevel: true,
        participantOccupation: true,
        wallet: {
          select: {
            balance: true,
            pendingRewards: true,
            totalEarned: true,
            totalWithdrawn: true,
            currency: true,
          },
        },
      },
    });

    if (!participant) {
      throw new BadRequestException('Participant not found');
    }

    if (
      participant.role !== UserRole.PARTICIPANT &&
      participant.role !== UserRole.BOTH
    ) {
      throw new ForbiddenException(
        'Only participants can access this dashboard',
      );
    }

    const isVerified = Boolean(
      participant.nicImagePath && participant.selfiePath,
    );

    const [
      completedSurveysCount,
      completedResponses,
      recentActivity,
      notifications,
      activeSurveys,
      weeklyCompletedResponses,
      wallet,
    ] = await Promise.all([
      this.prisma.surveyResponse.count({
        where: {
          participantId,
          status: SurveyResponseStatus.COMPLETED,
        },
      }),

      this.prisma.surveyResponse.findMany({
        where: {
          participantId,
          status: SurveyResponseStatus.COMPLETED,
        },
        select: {
          rewardAmount: true,
          rewardStatus: true,
        },
      }),

      this.prisma.surveyResponse.findMany({
        where: {
          participantId,
          status: SurveyResponseStatus.COMPLETED,
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          completedAt: true,
          rewardAmount: true,
          rewardStatus: true,
          survey: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
        },
      }),

      this.prisma.notification.findMany({
        where: {
          userId: participantId,
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

      this.prisma.survey.findMany({
        where: {
          status: SurveyStatus.ACTIVE,
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: 30,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          audience: true,
          estimatedCompletionDays: true,
          publishedAt: true,
          creatorId: true,
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
              rewardPerParticipant: true,
              currency: true,
            },
          },
          responses: {
            select: {
              participantId: true,
              status: true,
            },
          },
        },
      }),

      this.getWeeklyCompletedResponses(participantId),

      this.getOrCreateWallet(participantId),
    ]);

    const totalEarned = completedResponses.reduce((sum, response) => {
      return sum + this.toNumber(response.rewardAmount);
    }, 0);

    const pendingRewards = completedResponses.reduce((sum, response) => {
      if (response.rewardStatus !== RewardStatus.PENDING) {
        return sum;
      }

      return sum + this.toNumber(response.rewardAmount);
    }, 0);

    const availableAndLocked = this.buildSurveyLists({
      participant,
      isVerified,
      activeSurveys,
      participantId,
    });

    const verificationProgress = this.getVerificationProgress({
      hasNicOrDrivingLicense: Boolean(participant.nicImagePath),
      hasSelfie: Boolean(participant.selfiePath),
      isVerified,
    });

    const earningsThisWeek = this.buildWeeklyEarnings(weeklyCompletedResponses);

    return {
      welcome: {
        username: participant.username,
      },

      summaryCards: {
        availableSurveys: availableAndLocked.availableSurveys.length,
        completedSurveys: completedSurveysCount,
        totalEarned,
        walletBalance: this.toNumber(wallet.balance),
      },

      wallet: {
        currentBalance: this.toNumber(wallet.balance),
        pendingRewards: this.toNumber(wallet.pendingRewards) || pendingRewards,
        totalWithdrawn: this.toNumber(wallet.totalWithdrawn),
        currency: wallet.currency,
      },

      verification: verificationProgress,

      availableSurveys: availableAndLocked.availableSurveys.slice(0, 5),

      lockedSurveys: availableAndLocked.lockedSurveys.slice(0, 5),

      recentActivity: recentActivity.map((activity) => ({
        id: activity.id,
        surveyId: activity.survey.id,
        surveyTitle: activity.survey.title,
        category: activity.survey.category,
        status: 'COMPLETED',
        rewardAmount: this.toNumber(activity.rewardAmount),
        rewardStatus: activity.rewardStatus,
        completedAt: activity.completedAt,
      })),

      earningsThisWeek,

      notifications,
    };
  }

  private buildSurveyLists(params: {
    participant: {
      participantAge: number | null;
      participantGender: unknown;
      participantCity: string | null;
      participantDistrict: string | null;
      participantEducationLevel: string | null;
      participantOccupation: string | null;
    };
    isVerified: boolean;
    activeSurveys: {
      id: string;
      title: string;
      description: string;
      category: unknown;
      audience: SurveyAudienceType;
      estimatedCompletionDays: number;
      publishedAt: Date | null;
      targetAudience: {
        minimumAge: number | null;
        maximumAge: number | null;
        gender: unknown;
        city: string | null;
        district: string | null;
        educationLevel: string | null;
        occupation: string | null;
        sampleBase: SurveyAudienceType;
      } | null;
      sampleBudget: {
        requiredResponses: number;
        rewardPerParticipant: unknown;
        currency: unknown;
      } | null;
      responses: {
        participantId: string | null;
        status: SurveyResponseStatus;
      }[];
    }[];
    participantId: string;
  }) {
    const availableSurveys: unknown[] = [];
    const lockedSurveys: unknown[] = [];

    for (const survey of params.activeSurveys) {
      const alreadyCompleted = survey.responses.some(
        (response) =>
          response.participantId === params.participantId &&
          response.status === SurveyResponseStatus.COMPLETED,
      );

      if (alreadyCompleted) {
        continue;
      }

      const completedCount = survey.responses.filter(
        (response) => response.status === SurveyResponseStatus.COMPLETED,
      ).length;

      const requiredResponses = survey.sampleBudget?.requiredResponses ?? 0;

      if (requiredResponses > 0 && completedCount >= requiredResponses) {
        continue;
      }

      const requiresVerified =
        survey.targetAudience?.sampleBase ===
          SurveyAudienceType.VERIFIED_USERS_ONLY ||
        survey.audience === SurveyAudienceType.VERIFIED_USERS_ONLY;

      const matchesProfile = this.matchesTargetAudience(
        params.participant,
        survey.targetAudience,
      );

      const card = {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        category: survey.category,
        estimatedTime: `${survey.estimatedCompletionDays} min`,
        rewardAmount: this.toNumber(survey.sampleBudget?.rewardPerParticipant),
        currency: survey.sampleBudget?.currency ?? 'LKR',
        isVerifiedOnly: requiresVerified,
        publishedAt: survey.publishedAt,
      };

      if (requiresVerified && !params.isVerified) {
        lockedSurveys.push({
          ...card,
          lockedReason: 'Verify your account to access this survey',
        });
        continue;
      }

      if (!matchesProfile) {
        continue;
      }

      availableSurveys.push(card);
    }

    return {
      availableSurveys,
      lockedSurveys,
    };
  }

  private matchesTargetAudience(
    participant: {
      participantAge: number | null;
      participantGender: unknown;
      participantCity: string | null;
      participantDistrict: string | null;
      participantEducationLevel: string | null;
      participantOccupation: string | null;
    },
    targetAudience: {
      minimumAge: number | null;
      maximumAge: number | null;
      gender: unknown;
      city: string | null;
      district: string | null;
      educationLevel: string | null;
      occupation: string | null;
    } | null,
  ): boolean {
    if (!targetAudience) {
      return true;
    }

    if (
      targetAudience.minimumAge !== null &&
      participant.participantAge !== null &&
      participant.participantAge < targetAudience.minimumAge
    ) {
      return false;
    }

    if (
      targetAudience.maximumAge !== null &&
      participant.participantAge !== null &&
      participant.participantAge > targetAudience.maximumAge
    ) {
      return false;
    }

    if (
      targetAudience.gender &&
      targetAudience.gender !== 'ALL' &&
      participant.participantGender &&
      participant.participantGender !== targetAudience.gender
    ) {
      return false;
    }

    if (
      targetAudience.city &&
      participant.participantCity &&
      participant.participantCity.toLowerCase() !==
        targetAudience.city.toLowerCase()
    ) {
      return false;
    }

    if (
      targetAudience.district &&
      participant.participantDistrict &&
      participant.participantDistrict.toLowerCase() !==
        targetAudience.district.toLowerCase()
    ) {
      return false;
    }

    if (
      targetAudience.educationLevel &&
      participant.participantEducationLevel &&
      participant.participantEducationLevel.toLowerCase() !==
        targetAudience.educationLevel.toLowerCase()
    ) {
      return false;
    }

    if (
      targetAudience.occupation &&
      participant.participantOccupation &&
      participant.participantOccupation.toLowerCase() !==
        targetAudience.occupation.toLowerCase()
    ) {
      return false;
    }

    return true;
  }

  private async getWeeklyCompletedResponses(participantId: string) {
    const today = new Date();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return this.prisma.surveyResponse.findMany({
      where: {
        participantId,
        status: SurveyResponseStatus.COMPLETED,
        completedAt: {
          gte: sevenDaysAgo,
          lte: today,
        },
      },
      select: {
        completedAt: true,
        rewardAmount: true,
      },
    });
  }

  private buildWeeklyEarnings(
    responses: {
      completedAt: Date | null;
      rewardAmount: unknown;
    }[],
  ) {
    const today = new Date();

    const result: {
      date: string;
      earned: number;
    }[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(today.getDate() - i);

      const key = date.toISOString().split('T')[0];

      result.push({
        date: key,
        earned: 0,
      });
    }

    for (const response of responses) {
      if (!response.completedAt) {
        continue;
      }

      const key = response.completedAt.toISOString().split('T')[0];

      const item = result.find((entry) => entry.date === key);

      if (item) {
        item.earned += this.toNumber(response.rewardAmount);
      }
    }

    return result;
  }

  private getVerificationProgress(params: {
    hasNicOrDrivingLicense: boolean;
    hasSelfie: boolean;
    isVerified: boolean;
  }) {
    const items = {
      uploadNicOrDrivingLicense: params.hasNicOrDrivingLicense,
      addSelfieVerification: params.hasSelfie,
      completeProfileReview: params.isVerified,
    };

    const completedCount = Object.values(items).filter(Boolean).length;
    const totalCount = Object.values(items).length;

    return {
      isVerified: params.isVerified,
      percentage: Math.round((completedCount / totalCount) * 100),
      items,
    };
  }

  private async getOrCreateWallet(userId: string) {
    const wallet = await this.prisma.participantWallet.findUnique({
      where: {
        userId,
      },
      select: {
        balance: true,
        pendingRewards: true,
        totalEarned: true,
        totalWithdrawn: true,
        currency: true,
      },
    });

    if (wallet) {
      return wallet;
    }

    return this.prisma.participantWallet.create({
      data: {
        userId,
      },
      select: {
        balance: true,
        pendingRewards: true,
        totalEarned: true,
        totalWithdrawn: true,
        currency: true,
      },
    });
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
      'toNumber' in value &&
      typeof value.toNumber === 'function'
    ) {
      return value.toNumber();
    }

    return Number(value);
  }
}
