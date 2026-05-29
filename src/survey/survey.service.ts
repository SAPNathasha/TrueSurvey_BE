import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../auth/prisma/prisma.service';
import { CreateSurveyBasicDetailsDto } from './dto/create-survey-basic-details.dto';
import { SurveyCreationStep, SurveyStatus } from '../generated/prisma/enums';

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
        title: true,
        description: true,
        category: true,
        estimatedCompletionDays: true,
        status: true,
        currentStep: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Survey basic details saved successfully',
      survey,
    };
  }
}
