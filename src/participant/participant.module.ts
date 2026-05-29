import { Module } from '@nestjs/common';

import { ParticipantController } from './participant.controller';
import { ParticipantService } from './participant.service';
import { PrismaService } from '../auth/prisma/prisma.service';
import { StorageService } from '../auth/storage/storage.service';

@Module({
  controllers: [ParticipantController],
  providers: [ParticipantService, PrismaService, StorageService],
})
export class ParticipantModule {}
