import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CreatorModule } from './creator/creator.module';
import { SurveyModule } from './survey/survey.module';

@Module({
  imports: [AuthModule, CreatorModule, SurveyModule],
})
export class AppModule {}
