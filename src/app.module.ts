import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from './auth/auth.module';
import { CreatorModule } from './creator/creator.module';
import { SurveyModule } from './survey/survey.module';
import { ParticipantModule } from './participant/participant.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    AuthModule,
    CreatorModule,
    SurveyModule,
    ParticipantModule,
  ],
})
export class AppModule {}
