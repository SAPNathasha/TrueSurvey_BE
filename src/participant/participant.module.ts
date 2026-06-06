import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ParticipantController } from './participant.controller';
import { ParticipantService } from './participant.service';
import { PrismaService } from '../auth/prisma/prisma.service';
import { StorageService } from '../auth/storage/storage.service';
import { IdentityVerificationQueue } from './identity-verification.queue';
import { IdentityVerificationProcessor } from './identity-verification.processor';
import { IDENTITY_VERIFICATION_QUEUE } from './verification.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: IDENTITY_VERIFICATION_QUEUE,
    }),
  ],
  controllers: [ParticipantController],
  providers: [
    ParticipantService,
    PrismaService,
    StorageService,
    IdentityVerificationQueue,
    IdentityVerificationProcessor,
  ],
})
export class ParticipantModule {}
