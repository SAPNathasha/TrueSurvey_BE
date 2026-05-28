import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'nicImage', maxCount: 1 },
        { name: 'selfieImage', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),

        fileFilter: (req, file, callback) => {
          const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
          ];

          if (!allowedMimeTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, JPEG, PNG, and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },

        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      },
    ),
  )
  register(
    @Body() registerDto: RegisterDto,
    @UploadedFiles()
    files?: {
      nicImage?: Express.Multer.File[];
      selfieImage?: Express.Multer.File[];
    },
  ) {
    return this.authService.register(registerDto, files);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  refresh(@Body() body: { userId: string; refreshToken: string }) {
    return this.authService.refreshTokens(body.userId, body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: { userId: string }) {
    return this.authService.logout(body.userId);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
