import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { CreatorDashboardResponse } from './types/dashboard.types';
import { CreatorSurveysResponse } from './types/survey-list.types';
import { Prisma } from '../generated/prisma/client';
import { SurveyStatus } from '../generated/prisma/enums';

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
}
