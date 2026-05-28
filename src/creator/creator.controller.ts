import { Controller, Get, Query } from '@nestjs/common';

import { CreatorService } from './creator.service';

@Controller('creator')
export class CreatorController {
  constructor(private readonly creatorService: CreatorService) {}

  @Get('dashboard')
  getDashboard(@Query('creatorId') creatorId: string) {
    return this.creatorService.getDashboard(creatorId);
  }
}
