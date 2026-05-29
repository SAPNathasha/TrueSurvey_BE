import { Controller, Get, Query } from '@nestjs/common';

import { ParticipantService } from './participant.service';
import { AvailableSurveysQueryDto } from './dto/available-surveys-query.dto';
import { ParticipantWalletQueryDto } from './dto/participant-wallet-query.dto';

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

  @Get('wallet')
  getWallet(@Query() query: ParticipantWalletQueryDto) {
    return this.participantService.getWallet(query);
  }
}
