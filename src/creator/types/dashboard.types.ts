import {
  NotificationType,
  SurveyCategory,
  SurveyStatus,
} from '../../generated/prisma/enums';

export type CreatorDashboardResponse = {
  welcome: {
    username: string;
    activeSurveys: number;
    totalResponses: number;
  };

  summaryCards: {
    totalSurveys: number;
    activeSurveys: number;
    totalResponses: number;
  };

  responseGrowth: {
    date: string;
    responses: number;
  }[];

  surveyStatus: {
    active: number;
    draft: number;
    closed: number;
    archived: number;
  };

  notifications: {
    id: string;
    title: string;
    message: string | null;
    type: NotificationType;
    isRead: boolean;
    createdAt: Date;
  }[];

  creatorProgress: {
    percentage: number;
    items: {
      addProfilePicture: boolean;
      verifyEmailAddress: boolean;
      createFirstSurvey: boolean;
      get10Responses: boolean;
      inviteTeamMembers: boolean;
    };
  };

  recentSurveys: {
    id: string;
    title: string;
    description: string | null;
    status: SurveyStatus;
    category: SurveyCategory;
    responseCount: number;
    updatedAt: Date;
  }[];
};
