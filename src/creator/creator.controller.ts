import { Controller, Get, Query } from '@nestjs/common';

import { CreatorService } from './creator.service';
import { GetSurveysQueryDto } from './dto/get-surveys-query.dto';

@Controller('creator')
export class CreatorController {
  constructor(private readonly creatorService: CreatorService) {}

  @Get('dashboard')
  getDashboard(@Query('creatorId') creatorId: string) {
    return this.creatorService.getDashboard(creatorId);
  }

  @Get('surveys')
  getSurveys(@Query() query: GetSurveysQueryDto) {
    return this.creatorService.getSurveys(
      query.creatorId,
      query.status,
      query.limit,
    );
  }
}
