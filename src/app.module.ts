import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CreatorModule } from './creator/creator.module';
import { SurveyModule } from './survey/survey.module';
import { ParticipantModule } from './participant/participant.module';

@Module({
  imports: [AuthModule, CreatorModule, SurveyModule, ParticipantModule],
})
export class AppModule {}
