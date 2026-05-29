import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { AvailableSurveysQueryDto } from './dto/available-surveys-query.dto';

import {
  AudienceGender,
  RewardStatus,
  SurveyAudienceType,
  SurveyBudgetCurrency,
  SurveyCategory,
  SurveyResponseStatus,
  SurveyStatus,
  UserRole,
} from '../generated/prisma/enums';

type DecimalLike = {
  toNumber: () => number;
};

function isDecimalLike(value: unknown): value is DecimalLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const possibleDecimal = value as { toNumber?: unknown };

  return typeof possibleDecimal.toNumber === 'function';
}

type ParticipantProfileForDashboard = {
  participantAge: number | null;
  participantGender: AudienceGender | null;
  participantCity: string | null;
  participantDistrict: string | null;
  participantEducationLevel: string | null;
  participantOccupation: string | null;
};

type DashboardActiveSurvey = {
  id: string;
  title: string;
  description: string;
  category: SurveyCategory;
  audience: SurveyAudienceType;
  estimatedCompletionDays: number;
  publishedAt: Date | null;
  creatorId: string;
  targetAudience: {
    minimumAge: number | null;
    maximumAge: number | null;
    gender: AudienceGender;
    city: string | null;
    district: string | null;
    educationLevel: string | null;
    occupation: string | null;
    sampleBase: SurveyAudienceType;
  } | null;
  sampleBudget: {
    requiredResponses: number;
    rewardPerParticipant: unknown;
    currency: SurveyBudgetCurrency;
  } | null;
  responses: {
    participantId: string | null;
    status: SurveyResponseStatus;
  }[];
};

type AvailableSurveyCard = {
  id: string;
  title: string;
  description: string;
  category: SurveyCategory;
  estimatedTime: string;
  estimatedCompletionDays: number;
  questionCount: number;
  rewardAmount: number;
  currency: SurveyBudgetCurrency;
  completedResponses: number;
  requiredResponses: number;
  completionPercentage: number;
  publishedAt: Date | null;
  isVerifiedOnly: boolean;
  isLocked: false;
  tags: string[];
};

type LockedSurveyCard = Omit<AvailableSurveyCard, 'isLocked'> & {
  isLocked: true;
  lockedReason: string;
};

type SurveyDisplayCard = AvailableSurveyCard | LockedSurveyCard;

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
      const rewardAmount = this.toNumber(response.rewardAmount);
      return sum + rewardAmount;
    }, 0);

    const pendingRewards = completedResponses.reduce((sum, response) => {
      if (response.rewardStatus !== RewardStatus.PENDING) {
        return sum;
      }

      const rewardAmount = this.toNumber(response.rewardAmount);
      return sum + rewardAmount;
    }, 0);

    const availableAndLocked = this.buildDashboardSurveyLists({
      participant: {
        participantAge: participant.participantAge,
        participantGender: participant.participantGender,
        participantCity: participant.participantCity,
        participantDistrict: participant.participantDistrict,
        participantEducationLevel: participant.participantEducationLevel,
        participantOccupation: participant.participantOccupation,
      },
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
        totalEarned: this.toNumber(wallet.totalEarned) || totalEarned,
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
        status: SurveyResponseStatus.COMPLETED,
        rewardAmount: this.toNumber(activity.rewardAmount),
        rewardStatus: activity.rewardStatus,
        completedAt: activity.completedAt,
      })),

      earningsThisWeek,

      notifications,
    };
  }

  async getAvailableSurveys(query: AvailableSurveysQueryDto) {
    const participantId = query.participantId;

    if (!participantId) {
      throw new BadRequestException('participantId is required');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const participant = await this.prisma.user.findUnique({
      where: {
        id: participantId,
      },
      select: {
        id: true,
        username: true,
        role: true,
        nicImagePath: true,
        selfiePath: true,
        participantAge: true,
        participantGender: true,
        participantCity: true,
        participantDistrict: true,
        participantEducationLevel: true,
        participantOccupation: true,
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
        'Only participants can view available surveys',
      );
    }

    const isVerified = Boolean(
      participant.nicImagePath && participant.selfiePath,
    );

    const activeSurveys = await this.prisma.survey.findMany({
      where: {
        status: SurveyStatus.ACTIVE,
        ...(query.search
          ? {
              OR: [
                {
                  title: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: {
        publishedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        audience: true,
        estimatedCompletionDays: true,
        publishedAt: true,

        questions: {
          select: {
            id: true,
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
    });

    const availableSurveys: AvailableSurveyCard[] = [];
    const lockedSurveys: LockedSurveyCard[] = [];

    for (const survey of activeSurveys) {
      const alreadyStartedOrCompleted = survey.responses.some(
        (response) => response.participantId === participantId,
      );

      if (alreadyStartedOrCompleted) {
        continue;
      }

      const completedResponses = survey.responses.filter(
        (response) => response.status === SurveyResponseStatus.COMPLETED,
      ).length;

      const requiredResponses = survey.sampleBudget?.requiredResponses ?? 0;

      if (requiredResponses > 0 && completedResponses >= requiredResponses) {
        continue;
      }

      const completionPercentage =
        requiredResponses > 0
          ? Math.round((completedResponses / requiredResponses) * 100)
          : 0;

      const requiresVerified =
        survey.audience === SurveyAudienceType.VERIFIED_USERS_ONLY ||
        survey.targetAudience?.sampleBase ===
          SurveyAudienceType.VERIFIED_USERS_ONLY;

      const matchesProfile = this.matchesTargetAudience(
        {
          participantAge: participant.participantAge,
          participantGender: participant.participantGender,
          participantCity: participant.participantCity,
          participantDistrict: participant.participantDistrict,
          participantEducationLevel: participant.participantEducationLevel,
          participantOccupation: participant.participantOccupation,
        },
        survey.targetAudience,
      );

      if (!matchesProfile) {
        continue;
      }

      const rewardAmount = this.toNumber(
        survey.sampleBudget?.rewardPerParticipant,
      );

      const baseCard = {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        category: survey.category,
        estimatedTime: `${survey.estimatedCompletionDays} min`,
        estimatedCompletionDays: survey.estimatedCompletionDays,
        questionCount: survey.questions.length,
        rewardAmount,
        currency: survey.sampleBudget?.currency ?? SurveyBudgetCurrency.LKR,
        completedResponses,
        requiredResponses,
        completionPercentage,
        publishedAt: survey.publishedAt,
        isVerifiedOnly: requiresVerified,
        tags: this.buildSurveyTags({
          rewardAmount,
          estimatedCompletionDays: survey.estimatedCompletionDays,
          publishedAt: survey.publishedAt,
          completedResponses,
        }),
      };

      if (requiresVerified && !isVerified) {
        lockedSurveys.push({
          ...baseCard,
          isLocked: true,
          lockedReason: 'Verify your identity to unlock this survey',
        });

        continue;
      }

      availableSurveys.push({
        ...baseCard,
        isLocked: false,
      });
    }

    const tab = query.tab ?? 'ALL';
    const sortBy = query.sortBy ?? 'MOST_RELEVANT';

    const filteredAvailable = this.filterSurveyCardsByTab(
      availableSurveys,
      tab,
    );

    const filteredLocked = this.filterSurveyCardsByTab(lockedSurveys, tab);

    const sortedAvailable = this.sortSurveyCards(filteredAvailable, sortBy);
    const sortedLocked = this.sortSurveyCards(filteredLocked, sortBy);

    const allDisplaySurveys = [...sortedAvailable, ...sortedLocked];

    const total = allDisplaySurveys.length;
    const paginatedSurveys = allDisplaySurveys.slice(skip, skip + limit);

    return {
      participant: {
        id: participant.id,
        username: participant.username,
        isVerified,
      },

      summary: {
        availableCount: availableSurveys.length,
        lockedCount: lockedSurveys.length,
        totalCount: availableSurveys.length + lockedSurveys.length,
      },

      filters: {
        search: query.search ?? null,
        tab,
        sortBy,
      },

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        showingFrom: total === 0 ? 0 : skip + 1,
        showingTo: Math.min(skip + limit, total),
      },

      surveys: paginatedSurveys,
    };
  }

  private buildDashboardSurveyLists(params: {
    participant: ParticipantProfileForDashboard;
    isVerified: boolean;
    activeSurveys: DashboardActiveSurvey[];
    participantId: string;
  }) {
    const availableSurveys: {
      id: string;
      title: string;
      description: string;
      category: SurveyCategory;
      estimatedTime: string;
      rewardAmount: number;
      currency: SurveyBudgetCurrency;
      isVerifiedOnly: boolean;
      publishedAt: Date | null;
    }[] = [];

    const lockedSurveys: {
      id: string;
      title: string;
      description: string;
      category: SurveyCategory;
      estimatedTime: string;
      rewardAmount: number;
      currency: SurveyBudgetCurrency;
      isVerifiedOnly: boolean;
      publishedAt: Date | null;
      lockedReason: string;
    }[] = [];

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
        currency: survey.sampleBudget?.currency ?? SurveyBudgetCurrency.LKR,
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
    participant: ParticipantProfileForDashboard,
    targetAudience: {
      minimumAge: number | null;
      maximumAge: number | null;
      gender: AudienceGender;
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
      targetAudience.gender !== AudienceGender.ALL &&
      participant.participantGender !== null &&
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

  private buildSurveyTags(params: {
    rewardAmount: number;
    estimatedCompletionDays: number;
    publishedAt: Date | null;
    completedResponses: number;
  }): string[] {
    const tags: string[] = [];

    if (params.rewardAmount >= 200) {
      tags.push('High Paying');
    }

    if (params.estimatedCompletionDays <= 10) {
      tags.push('Short Survey');
    }

    if (params.completedResponses >= 100) {
      tags.push('Trending');
    }

    if (params.publishedAt) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (params.publishedAt >= sevenDaysAgo) {
        tags.push('New');
      }
    }

    return tags;
  }

  private filterSurveyCardsByTab<T extends SurveyDisplayCard>(
    surveys: T[],
    tab: 'ALL' | 'HIGH_PAYING' | 'SHORT_SURVEYS' | 'TRENDING' | 'NEW',
  ): T[] {
    if (tab === 'ALL') {
      return surveys;
    }

    if (tab === 'HIGH_PAYING') {
      return surveys.filter((survey) => survey.tags.includes('High Paying'));
    }

    if (tab === 'SHORT_SURVEYS') {
      return surveys.filter((survey) => survey.tags.includes('Short Survey'));
    }

    if (tab === 'TRENDING') {
      return surveys.filter((survey) => survey.tags.includes('Trending'));
    }

    if (tab === 'NEW') {
      return surveys.filter((survey) => survey.tags.includes('New'));
    }

    return surveys;
  }

  private sortSurveyCards<T extends SurveyDisplayCard>(
    surveys: T[],
    sortBy:
      | 'MOST_RELEVANT'
      | 'REWARD_HIGH'
      | 'REWARD_LOW'
      | 'NEWEST'
      | 'SHORTEST',
  ): T[] {
    const sorted = [...surveys];

    if (sortBy === 'REWARD_HIGH') {
      return sorted.sort((a, b) => b.rewardAmount - a.rewardAmount);
    }

    if (sortBy === 'REWARD_LOW') {
      return sorted.sort((a, b) => a.rewardAmount - b.rewardAmount);
    }

    if (sortBy === 'NEWEST') {
      return sorted.sort((a, b) => {
        const aTime = a.publishedAt?.getTime() ?? 0;
        const bTime = b.publishedAt?.getTime() ?? 0;

        return bTime - aTime;
      });
    }

    if (sortBy === 'SHORTEST') {
      return sorted.sort(
        (a, b) => a.estimatedCompletionDays - b.estimatedCompletionDays,
      );
    }

    return sorted.sort((a, b) => {
      if (a.isLocked !== b.isLocked) {
        return a.isLocked ? 1 : -1;
      }

      return b.rewardAmount - a.rewardAmount;
    });
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

      const key = date.toISOString().split('T')[0] ?? '';

      result.push({
        date: key,
        earned: 0,
      });
    }

    for (const response of responses) {
      if (!response.completedAt) {
        continue;
      }

      const key = response.completedAt.toISOString().split('T')[0] ?? '';

      const item = result.find((entry) => entry.date === key);

      if (item) {
        const rewardAmount = this.toNumber(response.rewardAmount);
        item.earned += rewardAmount;
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

    if (isDecimalLike(value)) {
      return value.toNumber();
    }

    return 0;
  }
}
