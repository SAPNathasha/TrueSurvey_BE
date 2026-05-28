import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { MailService } from './mail/mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, StorageService, MailService],
  exports: [AuthService],
})
export class AuthModule {}
