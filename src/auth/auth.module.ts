import { Global, Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { MailService } from './mail/mail.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { IdentityVerificationQueue } from '../participant/identity-verification.queue';
import { IDENTITY_VERIFICATION_QUEUE } from '../participant/verification.constants';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({}),
    BullModule.registerQueue({
      name: IDENTITY_VERIFICATION_QUEUE,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    StorageService,
    MailService,
    JwtService,
    JwtAuthGuard,
    RolesGuard,
    IdentityVerificationQueue,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
