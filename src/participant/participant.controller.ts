import { Controller, Get, Query } from '@nestjs/common';

import { ParticipantService } from './participant.service';
import { AvailableSurveysQueryDto } from './dto/available-surveys-query.dto';

@Controller('participant')
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @Get('dashboard')
  getDashboard(@Query('participantId') participantId: string) {
    return this.participantService.getDashboard(participantId);
  }

  @Get('available-surveys')
  getAvailableSurveys(@Query() query: AvailableSurveysQueryDto) {
    return this.participantService.getAvailableSurveys(query);
  }
}
