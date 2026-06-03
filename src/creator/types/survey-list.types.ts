import { SurveyCategory, SurveyStatus } from '../../generated/prisma/enums';

export type CreatorSurveySummary = {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  category: SurveyCategory;
  responseCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatorSurveysResponse = {
  surveys: CreatorSurveySummary[];
  total: number;
};
