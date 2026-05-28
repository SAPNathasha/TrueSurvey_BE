import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CreatorModule } from './creator/creator.module';

@Module({
  imports: [AuthModule],
})
@Module({
  imports: [AuthModule, CreatorModule],
})
export class AppModule {}
