import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as crypto from 'crypto';

import { PrismaService } from '../auth/prisma/prisma.service';
import { AvailableSurveysQueryDto } from './dto/available-surveys-query.dto';
import { ParticipantWalletQueryDto } from './dto/participant-wallet-query.dto';
import { SubmitSurveyDto } from './dto/submit-survey.dto';
import { TransactionRecordsQueryDto } from './dto/transaction-records-query.dto';
import { UpdateParticipantProfileDto } from './dto/update-participant-profile.dto';
import { VerifyNicDto } from './dto/verify-nic.dto';
import { StorageService } from '../auth/storage/storage.service';
import type { Express } from 'express';
import { IdentityVerificationQueue } from './identity-verification.queue';

import {
  AudienceGender,
  RewardStatus,
  SurveyAudienceType,
  SurveyBudgetCurrency,
  SurveyCategory,
  SurveyQuestionType,
  SurveyResponseStatus,
  SurveyStatus,
  UserRole,
  WalletTransactionStatus,
  WalletTransactionType,
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

type WalletTableRow = {
  id: string;
  rowType: 'SURVEY_REWARD' | 'WITHDRAWAL';
  surveyId: string | null;
  surveyName: string;
  category: SurveyCategory | null;
  status: string;
  earnedMoney: number;
  date: Date | null;
  paymentMethod: string;
  action: string;
};

type ParticipantSurveyAccessContext = {
  id: string;
  username: string;
  role: UserRole;
  nicImagePath: string | null;
  selfiePath: string | null;
  isIdentityVerified: boolean;
  participantAge: number | null;
  participantGender: AudienceGender | null;
  participantCity: string | null;
  participantDistrict: string | null;
  participantEducationLevel: string | null;
  participantOccupation: string | null;
};

type ParticipantAccessibleSurvey = {
  id: string;
  title: string;
  description: string;
  category: SurveyCategory;
  audience: SurveyAudienceType;
  status: SurveyStatus;
  estimatedCompletionDays: number;
  publishedAt: Date | null;
  questions: {
    id: string;
    questionText: string;
    type: SurveyQuestionType;
    source: string;
    order: number;
    isRequired: boolean;
    options: {
      id: string;
      optionText: string;
      order: number;
    }[];
  }[];
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
    totalBudget: unknown;
    participantRewardBudget: unknown;
    rewardDistribution: string;
  } | null;
  responses: {
    participantId: string | null;
    status: SurveyResponseStatus;
  }[];
};

@Injectable()
export class ParticipantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly identityVerificationQueue: IdentityVerificationQueue,
  ) {}

  async getProfileSettings(participantId: string) {
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
        fullName: true,
        email: true,
        role: true,

        phoneCountryCode: true,
        phoneNumber: true,
        dateOfBirth: true,

        profileImagePath: true,
        isEmailVerified: true,
        isIdentityVerified: true,

        nicImagePath: true,
        selfiePath: true,

        participantAge: true,
        participantGender: true,
        participantCity: true,
        participantDistrict: true,
        participantEducationLevel: true,
        participantOccupation: true,
        participantAddress: true,

        createdAt: true,

        surveyResponses: {
          where: {
            status: SurveyResponseStatus.COMPLETED,
          },
          select: {
            id: true,
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
        'Only participants can access profile settings',
      );
    }

    return {
      profile: {
        id: participant.id,
        username: participant.username,
        fullName: participant.fullName,
        email: participant.email,

        phoneCountryCode: participant.phoneCountryCode,
        phoneNumber: participant.phoneNumber,
        dateOfBirth: participant.dateOfBirth,

        profileImagePath: participant.profileImagePath,
        isIdentityVerified: participant.isIdentityVerified,

        participantAge: participant.participantAge,
        participantGender: participant.participantGender,
        participantCity: participant.participantCity,
        participantDistrict: participant.participantDistrict,
        participantEducationLevel: participant.participantEducationLevel,
        participantOccupation: participant.participantOccupation,
        participantAddress: participant.participantAddress,
      },

      accountOverview: {
        memberSince: participant.createdAt,
        accountStatus: 'ACTIVE',
        emailVerified: participant.isEmailVerified,
        verificationStatus: participant.isIdentityVerified
          ? 'VERIFIED'
          : 'NOT_VERIFIED',
        totalSurveysCompleted: participant.surveyResponses.length,
      },
    };
  }

  async updateProfileSettings(dto: UpdateParticipantProfileDto) {
    const participant = await this.prisma.user.findUnique({
      where: {
        id: dto.participantId,
      },
      select: {
        id: true,
        role: true,
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
        'Only participants can update profile settings',
      );
    }

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;

    const updatedParticipant = await this.prisma.user.update({
      where: {
        id: dto.participantId,
      },
      data: {
        fullName: dto.fullName,
        username: dto.username,

        phoneCountryCode: dto.phoneCountryCode,
        phoneNumber: dto.phoneNumber,
        dateOfBirth,

        participantAge: dto.participantAge,
        participantGender: dto.participantGender,
        participantCity: dto.participantCity,
        participantDistrict: dto.participantDistrict,
        participantEducationLevel: dto.participantEducationLevel,
        participantOccupation: dto.participantOccupation,
        participantAddress: dto.participantAddress,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,

        phoneCountryCode: true,
        phoneNumber: true,
        dateOfBirth: true,

        profileImagePath: true,

        participantAge: true,
        participantGender: true,
        participantCity: true,
        participantDistrict: true,
        participantEducationLevel: true,
        participantOccupation: true,
        participantAddress: true,

        updatedAt: true,
      },
    });

    return {
      message: 'Profile settings updated successfully',
      profile: updatedParticipant,
    };
  }

  async verifyNic(
    userId: string,
    dto: VerifyNicDto,
    files: {
      identityFrontImage?: Express.Multer.File[];
      selfieImage?: Express.Multer.File[];
    },
  ) {
    try {
      const identityFrontImage = files?.identityFrontImage?.[0];
      const selfieImage = files?.selfieImage?.[0];

      if (!userId) {
        throw new BadRequestException('userId is required');
      }

      if (!dto.nicNumber?.trim()) {
        throw new BadRequestException('nicNumber is required');
      }

      if (!identityFrontImage) {
        throw new BadRequestException('identityFrontImage is required');
      }

      if (!selfieImage) {
        throw new BadRequestException('selfieImage is required');
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.role !== UserRole.PARTICIPANT && user.role !== UserRole.BOTH) {
        throw new ForbiddenException(
          'Only participants can submit NIC verification',
        );
      }

      const nicHash = this.hashNic(dto.nicNumber);

      const existingNicUser = await this.prisma.user.findFirst({
        where: {
          nicHash,
          id: {
            not: user.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingNicUser) {
        throw new ConflictException('This NIC is already registered');
      }

      const [identityFrontImageUrl, selfieImageUrl] = await Promise.all([
        this.storageService.uploadImage(
          identityFrontImage,
          `users/${user.id}/verification/nic`,
        ),
        this.storageService.uploadImage(
          selfieImage,
          `users/${user.id}/verification/selfie`,
        ),
      ]);

      const updatedUser = await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          nicHash,
          nicImagePath: identityFrontImageUrl,
          selfiePath: selfieImageUrl,
          isIdentityVerified: false,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          nicImagePath: true,
          selfiePath: true,
          isIdentityVerified: true,
          updatedAt: true,
        },
      });

      const verificationJob =
        await this.identityVerificationQueue.enqueueVerification({
          userId: user.id,
          nicNumber: dto.nicNumber.trim(),
          documentImageUrl: identityFrontImageUrl,
          selfieImageUrl,
        });

      return {
        message:
          'NIC verification details uploaded successfully and queued for verification',
        user: updatedUser,
        verification: {
          nicNumberProvided: true,
          identityFrontImageUploaded: true,
          selfieImageUploaded: true,
          queueJobId: verificationJob.id,
          queueStatus: 'QUEUED',
        },
      };
    } catch (error) {
      console.log('verifyNic error:', error);
      throw error;
    }
  }

  async updateProfilePhoto(
    participantId: string,
    profilePhoto?: Express.Multer.File,
  ) {
    if (!participantId) {
      throw new BadRequestException('participantId is required');
    }

    if (!profilePhoto) {
      throw new BadRequestException('profilePhoto is required');
    }

    const participant = await this.prisma.user.findUnique({
      where: {
        id: participantId,
      },
      select: {
        id: true,
        role: true,
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
        'Only participants can update profile photo',
      );
    }

    const profileImageUrl = await this.storageService.uploadImage(
      profilePhoto,
      `users/${participantId}/profile`,
    );

    const updatedParticipant = await this.prisma.user.update({
      where: {
        id: participantId,
      },
      data: {
        profileImagePath: profileImageUrl,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        profileImagePath: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Profile photo updated successfully',
      profile: updatedParticipant,
    };
  }
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
        isIdentityVerified: true,
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

    const isVerified = participant.isIdentityVerified;

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
      isVerified: participant.isIdentityVerified,
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

    const participant =
      await this.getParticipantSurveyAccessContext(participantId);

    const isVerified = this.isParticipantVerified(participant);

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

  async getAvailableSurveyById(participantId: string, surveyId: string) {
    const {
      participant,
      isVerified,
      survey,
      completedResponses,
      requiredResponses,
      requiresVerified,
      rewardAmount,
      completionPercentage,
    } = await this.getSubmittableSurveyContext(participantId, surveyId);

    return {
      participant: {
        id: participant.id,
        username: participant.username,
        isVerified,
      },
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        category: survey.category,
        audience: survey.audience,
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
        targetAudience: survey.targetAudience,
        sampleBudget: survey.sampleBudget
          ? {
              requiredResponses: survey.sampleBudget.requiredResponses,
              rewardPerParticipant: rewardAmount,
              currency: survey.sampleBudget.currency,
              totalBudget: this.toNumber(survey.sampleBudget.totalBudget),
              participantRewardBudget: this.toNumber(
                survey.sampleBudget.participantRewardBudget,
              ),
              rewardDistribution: survey.sampleBudget.rewardDistribution,
            }
          : null,
        questions: survey.questions.map((question) => ({
          id: question.id,
          questionText: question.questionText,
          type: question.type,
          source: question.source,
          order: question.order,
          isRequired: question.isRequired,
          options: question.options,
        })),
      },
      submission: {
        participantId: participant.id,
        surveyId: survey.id,
        questionCount: survey.questions.length,
        canSubmit: true,
      },
    };
  }

  async submitSurvey(
    participantId: string,
    surveyId: string,
    dto: SubmitSurveyDto,
  ) {
    const {
      participant,
      survey,
      completedResponses,
      requiredResponses,
      rewardAmount,
    } = await this.getSubmittableSurveyContext(participantId, surveyId);

    this.validateSurveyAnswers(survey, dto.answers);

    const completedAt = new Date();

    const submission = await this.prisma.$transaction(async (tx) => {
      const surveyResponse = await tx.surveyResponse.create({
        data: {
          surveyId: survey.id,
          participantId: participant.id,
          status: SurveyResponseStatus.COMPLETED,
          rewardAmount,
          rewardStatus: RewardStatus.PENDING,
          completedAt,
        },
        select: {
          id: true,
          surveyId: true,
          participantId: true,
          status: true,
          rewardAmount: true,
          rewardStatus: true,
          startedAt: true,
          completedAt: true,
        },
      });

      await tx.surveyResponseAnswer.createMany({
        data: this.buildSurveyResponseAnswerRecords(
          surveyResponse.id,
          survey,
          dto.answers,
        ),
      });

      await tx.participantWallet.upsert({
        where: {
          userId: participant.id,
        },
        create: {
          userId: participant.id,
          pendingRewards: rewardAmount,
          totalEarned: rewardAmount,
          currency: survey.sampleBudget?.currency ?? SurveyBudgetCurrency.LKR,
        },
        update: {
          pendingRewards: {
            increment: rewardAmount,
          },
          totalEarned: {
            increment: rewardAmount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          userId: participant.id,
          surveyResponseId: surveyResponse.id,
          type: WalletTransactionType.SURVEY_REWARD,
          status: WalletTransactionStatus.PENDING,
          amount: rewardAmount,
          currency: survey.sampleBudget?.currency ?? SurveyBudgetCurrency.LKR,
          description: `Reward for completing survey: ${survey.title}`,
        },
      });

      return surveyResponse;
    });

    return {
      message: 'Survey submitted successfully',
      submission: {
        id: submission.id,
        surveyId: submission.surveyId,
        participantId: submission.participantId,
        status: submission.status,
        rewardAmount: this.toNumber(submission.rewardAmount),
        rewardStatus: submission.rewardStatus,
        completedAt: submission.completedAt,
      },
      summary: {
        surveyTitle: survey.title,
        answerCount: dto.answers.length,
        completedResponses: completedResponses + 1,
        requiredResponses,
      },
    };
  }

  async getWallet(query: ParticipantWalletQueryDto) {
    const participantId = query.participantId;

    if (!participantId) {
      throw new BadRequestException('participantId is required');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const skip = (page - 1) * limit;

    const participant = await this.prisma.user.findUnique({
      where: {
        id: participantId,
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    if (!participant) {
      throw new BadRequestException('Participant not found');
    }

    if (
      participant.role !== UserRole.PARTICIPANT &&
      participant.role !== UserRole.BOTH
    ) {
      throw new ForbiddenException('Only participants can access wallet');
    }

    const wallet = await this.getOrCreateWallet(participantId);

    const [completedResponses, withdrawalTransactions, allTransactions] =
      await Promise.all([
        this.prisma.surveyResponse.findMany({
          where: {
            participantId,
            status: SurveyResponseStatus.COMPLETED,
          },
          orderBy: {
            completedAt: 'desc',
          },
          select: {
            id: true,
            rewardAmount: true,
            rewardStatus: true,
            completedAt: true,
            survey: {
              select: {
                id: true,
                title: true,
                category: true,
              },
            },
          },
        }),

        this.prisma.walletTransaction.findMany({
          where: {
            userId: participantId,
            type: WalletTransactionType.WITHDRAWAL,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            description: true,
            createdAt: true,
          },
        }),

        this.prisma.walletTransaction.findMany({
          where: {
            userId: participantId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            currency: true,
            description: true,
            createdAt: true,
          },
        }),
      ]);

    const rewardRows: WalletTableRow[] = completedResponses.map((response) => {
      const status =
        response.rewardStatus === RewardStatus.RELEASED
          ? 'COMPLETED'
          : response.rewardStatus === RewardStatus.WITHDRAWN
            ? 'PAID'
            : 'PENDING';

      return {
        id: response.id,
        rowType: 'SURVEY_REWARD',
        surveyId: response.survey.id,
        surveyName: response.survey.title,
        category: response.survey.category,
        status,
        earnedMoney: this.toNumber(response.rewardAmount),
        date: response.completedAt,
        paymentMethod: 'Wallet Balance',
        action: 'View details',
      };
    });

    const withdrawalRows: WalletTableRow[] = allTransactions
      .filter(
        (transaction) => transaction.type === WalletTransactionType.WITHDRAWAL,
      )
      .map((transaction) => ({
        id: transaction.id,
        rowType: 'WITHDRAWAL',
        surveyId: null,
        surveyName: transaction.description ?? 'Withdrawal',
        category: null,
        status:
          transaction.status === WalletTransactionStatus.COMPLETED
            ? 'PAID'
            : transaction.status === WalletTransactionStatus.PENDING
              ? 'PROCESSING'
              : 'FAILED',
        earnedMoney: this.toNumber(transaction.amount),
        date: transaction.createdAt,
        paymentMethod: 'Bank Transfer',
        action: 'View details',
      }));

    let tableRows: WalletTableRow[] = [...rewardRows, ...withdrawalRows];

    if (query.search) {
      const search = query.search.toLowerCase();

      tableRows = tableRows.filter((row) =>
        row.surveyName.toLowerCase().includes(search),
      );
    }

    if (query.status && query.status !== 'ALL') {
      if (query.status === 'WITHDRAWALS') {
        tableRows = tableRows.filter((row) => row.rowType === 'WITHDRAWAL');
      } else {
        tableRows = tableRows.filter((row) => row.status === query.status);
      }
    }

    tableRows = this.sortWalletRows(tableRows, query.sortBy ?? 'MOST_RECENT');

    const total = tableRows.length;
    const paginatedTransactions = tableRows.slice(skip, skip + limit);

    const earningsTrend = this.buildEarningsTrend(completedResponses);

    const earningsBreakdown = this.buildEarningsBreakdown({
      completedResponses,
      withdrawalTransactions,
    });

    const recentWithdrawals = withdrawalTransactions.map((withdrawal) => ({
      id: withdrawal.id,
      amount: this.toNumber(withdrawal.amount),
      currency: withdrawal.currency,
      status: withdrawal.status,
      method: withdrawal.description ?? 'Bank Transfer',
      createdAt: withdrawal.createdAt,
    }));

    return {
      participant: {
        id: participant.id,
        username: participant.username,
      },

      summaryCards: {
        currentWalletBalance: this.toNumber(wallet.balance),
        pendingEarnings: this.toNumber(wallet.pendingRewards),
        totalEarned: this.toNumber(wallet.totalEarned),
        totalWithdrawn: this.toNumber(wallet.totalWithdrawn),
        currency: wallet.currency,
      },

      walletBalance: {
        amount: this.toNumber(wallet.balance),
        growthPercentage: 12.5,
        currency: wallet.currency,
      },

      earningsTrend,

      filters: {
        search: query.search ?? null,
        status: query.status ?? 'ALL',
        sortBy: query.sortBy ?? 'MOST_RECENT',
      },

      transactions: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          showingFrom: total === 0 ? 0 : skip + 1,
          showingTo: Math.min(skip + limit, total),
        },
        rows: paginatedTransactions,
      },

      recentWithdrawals,

      earningsBreakdown,

      withdrawalMethod: {
        type: 'BANK_ACCOUNT',
        name: 'Bank Account',
        description: 'Commercial Bank •••• 1234',
        isDefault: true,
      },

      walletTips: [
        'Complete more surveys to increase your earnings.',
        'Verify your account to access high paying surveys.',
        'Keep your profile updated for better matches.',
        'Withdrawals are processed within 1–3 business days.',
      ],
    };
  }

  async getSurveySubmissions(userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const participant = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        role: true,
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
        'Only participants can access survey submissions',
      );
    }

    const submissions = await this.prisma.surveyResponse.findMany({
      where: {
        participantId: userId,
      },
      orderBy: {
        completedAt: 'desc',
      },
      select: {
        id: true,
        rewardStatus: true,
        rewardAmount: true,
        completedAt: true,
        createdAt: true,
        survey: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return {
      participant: {
        id: participant.id,
        username: participant.username,
      },
      total: submissions.length,
      submissions: submissions.map((submission) => ({
        submissionId: submission.id,
        surveyId: submission.survey.id,
        surveyTitle: submission.survey.title,
        rewardStatus: submission.rewardStatus,
        submittedAt: submission.completedAt ?? submission.createdAt,
        amount: this.toNumber(submission.rewardAmount),
      })),
    };
  }

  async deleteSurveySubmission(userId: string, submissionId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    if (!submissionId) {
      throw new BadRequestException('submissionId is required');
    }

    const participant = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        role: true,
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
        'Only participants can delete survey submissions',
      );
    }

    const submission = await this.prisma.surveyResponse.findUnique({
      where: {
        id: submissionId,
      },
      select: {
        id: true,
        participantId: true,
        rewardStatus: true,
        rewardAmount: true,
        surveyId: true,
        survey: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!submission || submission.participantId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own survey submissions',
      );
    }

    if (submission.rewardStatus !== RewardStatus.PENDING) {
      throw new BadRequestException(
        'Only submissions with pending reward status can be deleted',
      );
    }

    const rewardAmount = this.toNumber(submission.rewardAmount);

    await this.prisma.$transaction(async (tx) => {
      await tx.walletTransaction.deleteMany({
        where: {
          surveyResponseId: submission.id,
          userId,
        },
      });

      if (rewardAmount > 0) {
        await tx.participantWallet.update({
          where: {
            userId,
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
      }

      await tx.surveyResponse.delete({
        where: {
          id: submission.id,
        },
      });
    });

    return {
      message: 'Survey submission deleted successfully',
      submission: {
        id: submission.id,
        surveyId: submission.surveyId,
        surveyTitle: submission.survey.title,
        rewardStatus: submission.rewardStatus,
        amount: rewardAmount,
      },
    };
  }

  async getTransactionRecords(
    userId: string,
    query: TransactionRecordsQueryDto,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        role: true,
        wallet: {
          select: {
            pendingRewards: true,
            totalEarned: true,
            totalWithdrawn: true,
            currency: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (
      user.role !== UserRole.PARTICIPANT &&
      user.role !== UserRole.CREATOR &&
      user.role !== UserRole.BOTH
    ) {
      throw new ForbiddenException('You cannot access transaction records');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const [total, totalPendingItems, totalTopupAggregate, transactions] =
      await Promise.all([
        this.prisma.walletTransaction.count({
          where: {
            userId,
          },
        }),
        this.prisma.walletTransaction.count({
          where: {
            userId,
            status: WalletTransactionStatus.PENDING,
          },
        }),
        this.prisma.walletTransaction.aggregate({
          where: {
            userId,
            type: WalletTransactionType.ADJUSTMENT,
            status: WalletTransactionStatus.COMPLETED,
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.walletTransaction.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: safeLimit,
          select: {
            id: true,
            amount: true,
            type: true,
            status: true,
            currency: true,
            description: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      summary: {
        totalPendingItems,
        totalTopupAmount: this.toNumber(totalTopupAggregate._sum.amount),
        paidOutAmount: this.toNumber(user.wallet?.totalWithdrawn),
        totalRewardsEarned: this.toNumber(user.wallet?.totalEarned),
        currency: user.wallet?.currency ?? SurveyBudgetCurrency.LKR,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        showingFrom: total === 0 ? 0 : skip + 1,
        showingTo: Math.min(skip + safeLimit, total),
      },
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.createdAt,
        amount: this.toNumber(transaction.amount),
        type: transaction.type,
        status: transaction.status,
        currency: transaction.currency,
        description: transaction.description,
      })),
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

  private async getSubmittableSurveyContext(
    participantId: string,
    surveyId: string,
  ) {
    if (!participantId) {
      throw new BadRequestException('participantId is required');
    }

    if (!surveyId) {
      throw new BadRequestException('surveyId is required');
    }

    const participant =
      await this.getParticipantSurveyAccessContext(participantId);
    const isVerified = this.isParticipantVerified(participant);

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        audience: true,
        status: true,
        estimatedCompletionDays: true,
        publishedAt: true,
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
            rewardPerParticipant: true,
            currency: true,
            totalBudget: true,
            participantRewardBudget: true,
            rewardDistribution: true,
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

    if (!survey || survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException('Survey not found');
    }

    const alreadyStartedOrCompleted = survey.responses.some(
      (response) => response.participantId === participantId,
    );

    if (alreadyStartedOrCompleted) {
      throw new ForbiddenException(
        'You have already started or completed this survey',
      );
    }

    const completedResponses = survey.responses.filter(
      (response) => response.status === SurveyResponseStatus.COMPLETED,
    ).length;

    const requiredResponses = survey.sampleBudget?.requiredResponses ?? 0;

    if (requiredResponses > 0 && completedResponses >= requiredResponses) {
      throw new ForbiddenException(
        'This survey is no longer accepting responses',
      );
    }

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
      throw new ForbiddenException(
        'You do not match the target audience for this survey',
      );
    }

    if (requiresVerified && !isVerified) {
      throw new ForbiddenException(
        'Verify your identity to access this survey',
      );
    }

    const rewardAmount = this.toNumber(
      survey.sampleBudget?.rewardPerParticipant,
    );
    const completionPercentage =
      requiredResponses > 0
        ? Math.round((completedResponses / requiredResponses) * 100)
        : 0;

    return {
      participant,
      isVerified,
      survey: survey as ParticipantAccessibleSurvey,
      completedResponses,
      requiredResponses,
      requiresVerified,
      rewardAmount,
      completionPercentage,
    };
  }

  private validateSurveyAnswers(
    survey: ParticipantAccessibleSurvey,
    answers: SubmitSurveyDto['answers'],
  ) {
    if (!answers.length) {
      throw new BadRequestException('At least one answer is required');
    }

    const answerMap = new Map<string, SubmitSurveyDto['answers'][number]>();

    for (const answer of answers) {
      if (answerMap.has(answer.questionId)) {
        throw new BadRequestException(
          `Duplicate answers found for question "${answer.questionId}"`,
        );
      }

      answerMap.set(answer.questionId, answer);
    }

    for (const question of survey.questions) {
      const answer = answerMap.get(question.id);

      if (question.isRequired && !answer) {
        throw new BadRequestException(
          `Answer is required for question "${question.questionText}"`,
        );
      }

      if (!answer) {
        continue;
      }

      const validOptionIds = new Set(
        question.options.map((option) => option.id),
      );

      if (question.type === SurveyQuestionType.MULTIPLE_CHOICE) {
        if (!answer.selectedOptionIds?.length) {
          throw new BadRequestException(
            `Please select at least one option for "${question.questionText}"`,
          );
        }

        for (const optionId of answer.selectedOptionIds) {
          if (!validOptionIds.has(optionId)) {
            throw new BadRequestException(
              `Invalid option selected for "${question.questionText}"`,
            );
          }
        }
      }

      if (
        question.type === SurveyQuestionType.SINGLE_SELECT ||
        question.type === SurveyQuestionType.YES_NO
      ) {
        if (
          question.type === SurveyQuestionType.YES_NO &&
          typeof answer.yesNoValue === 'boolean'
        ) {
          continue;
        }

        if (
          !answer.selectedOptionId ||
          !validOptionIds.has(answer.selectedOptionId)
        ) {
          throw new BadRequestException(
            `Please select a valid option for "${question.questionText}"`,
          );
        }
      }

      if (question.type === SurveyQuestionType.RATING_SCALE) {
        if (
          typeof answer.ratingValue !== 'number' ||
          Number.isNaN(answer.ratingValue)
        ) {
          throw new BadRequestException(
            `Please provide a valid rating for "${question.questionText}"`,
          );
        }
      }

      if (
        question.type === SurveyQuestionType.SHORT_ANSWER ||
        question.type === SurveyQuestionType.LONG_ANSWER
      ) {
        if (!answer.answerText?.trim()) {
          throw new BadRequestException(
            `Please provide an answer for "${question.questionText}"`,
          );
        }
      }
    }

    for (const answer of answers) {
      const questionExists = survey.questions.some(
        (question) => question.id === answer.questionId,
      );

      if (!questionExists) {
        throw new BadRequestException(
          `Question "${answer.questionId}" does not belong to this survey`,
        );
      }
    }
  }

  private buildSurveyResponseAnswerRecords(
    surveyResponseId: string,
    survey: ParticipantAccessibleSurvey,
    answers: SubmitSurveyDto['answers'],
  ) {
    const questionMap = new Map(
      survey.questions.map((question) => [question.id, question]),
    );

    return answers.map((answer) => {
      const question = questionMap.get(answer.questionId);

      if (!question) {
        throw new BadRequestException(
          `Question "${answer.questionId}" does not belong to this survey`,
        );
      }

      const normalizedText = answer.answerText?.trim() || null;
      const selectedOptionIds = [...(answer.selectedOptionIds ?? [])];
      const selectedOptionId = answer.selectedOptionId ?? null;
      const ratingValue =
        typeof answer.ratingValue === 'number' ? answer.ratingValue : null;
      const booleanValue =
        typeof answer.yesNoValue === 'boolean' ? answer.yesNoValue : null;

      if (
        question.type === SurveyQuestionType.SINGLE_SELECT &&
        selectedOptionId &&
        selectedOptionIds.length === 0
      ) {
        selectedOptionIds.push(selectedOptionId);
      }

      return {
        surveyResponseId,
        questionId: question.id,
        questionType: question.type,
        answerText: normalizedText,
        selectedOptionId,
        selectedOptionIds,
        ratingValue,
        booleanValue,
      };
    });
  }

  private async getParticipantSurveyAccessContext(
    participantId: string,
  ): Promise<ParticipantSurveyAccessContext> {
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
        isIdentityVerified: true,
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

    return participant;
  }

  private isParticipantVerified(
    participant: Pick<ParticipantSurveyAccessContext, 'isIdentityVerified'>,
  ) {
    return participant.isIdentityVerified;
  }

  private hashNic(nicNumber: string): string {
    const secret = process.env.NIC_HASH_SECRET;

    if (!secret) {
      throw new Error('NIC_HASH_SECRET is missing in .env file');
    }

    const normalizedNic = nicNumber.trim().toUpperCase();

    return crypto
      .createHmac('sha256', secret)
      .update(normalizedNic)
      .digest('hex');
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

  private sortWalletRows(
    rows: WalletTableRow[],
    sortBy: 'MOST_RECENT' | 'OLDEST' | 'AMOUNT_HIGH' | 'AMOUNT_LOW',
  ): WalletTableRow[] {
    const sorted = [...rows];

    if (sortBy === 'OLDEST') {
      return sorted.sort((a, b) => {
        const aTime = a.date?.getTime() ?? 0;
        const bTime = b.date?.getTime() ?? 0;

        return aTime - bTime;
      });
    }

    if (sortBy === 'AMOUNT_HIGH') {
      return sorted.sort((a, b) => b.earnedMoney - a.earnedMoney);
    }

    if (sortBy === 'AMOUNT_LOW') {
      return sorted.sort((a, b) => a.earnedMoney - b.earnedMoney);
    }

    return sorted.sort((a, b) => {
      const aTime = a.date?.getTime() ?? 0;
      const bTime = b.date?.getTime() ?? 0;

      return bTime - aTime;
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
        item.earned += this.toNumber(response.rewardAmount);
      }
    }

    return result;
  }

  private buildEarningsTrend(
    completedResponses: {
      completedAt: Date | null;
      rewardAmount: unknown;
    }[],
  ) {
    const today = new Date();

    const result: {
      date: string;
      earned: number;
    }[] = [];

    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(today.getDate() - i);

      const key = date.toISOString().split('T')[0] ?? '';

      result.push({
        date: key,
        earned: 0,
      });
    }

    for (const response of completedResponses) {
      if (!response.completedAt) {
        continue;
      }

      const key = response.completedAt.toISOString().split('T')[0] ?? '';
      const item = result.find((entry) => entry.date === key);

      if (item) {
        item.earned += this.toNumber(response.rewardAmount);
      }
    }

    return result;
  }

  private buildEarningsBreakdown(params: {
    completedResponses: {
      rewardAmount: unknown;
      rewardStatus: RewardStatus;
    }[];
    withdrawalTransactions: {
      amount: unknown;
      status: WalletTransactionStatus;
    }[];
  }) {
    const completed = params.completedResponses.reduce((sum, response) => {
      if (response.rewardStatus !== RewardStatus.RELEASED) {
        return sum;
      }

      return sum + this.toNumber(response.rewardAmount);
    }, 0);

    const pending = params.completedResponses.reduce((sum, response) => {
      if (response.rewardStatus !== RewardStatus.PENDING) {
        return sum;
      }

      return sum + this.toNumber(response.rewardAmount);
    }, 0);

    const withdrawn = params.withdrawalTransactions.reduce(
      (sum, transaction) => {
        if (transaction.status !== WalletTransactionStatus.COMPLETED) {
          return sum;
        }

        return sum + this.toNumber(transaction.amount);
      },
      0,
    );

    const processing = params.withdrawalTransactions.reduce(
      (sum, transaction) => {
        if (transaction.status !== WalletTransactionStatus.PENDING) {
          return sum;
        }

        return sum + this.toNumber(transaction.amount);
      },
      0,
    );

    return {
      completed,
      pending,
      processing,
      withdrawn,
      totalEarned: completed + pending,
    };
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
