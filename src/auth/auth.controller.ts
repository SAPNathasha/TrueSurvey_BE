import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenPayload } from './types/token-payload.type';
import { JwtService } from '@nestjs/jwt';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

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
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Refresh token is saved as an HTTP-only cookie
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: false, // true in production with HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 5 minutes
    });

    // Access token is returned to frontend
    // Frontend should send it later as Bearer token
    return {
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(@Req() request: Request) {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const result = await this.authService.refreshTokens(
      payload.sub,
      refreshToken,
    );

    return {
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  logout(
    @Body() body: { userId: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
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
  @Post('verify-email')
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Post('resend-email-verification')
  resendEmailVerification(
    @Body() resendEmailVerificationDto: ResendEmailVerificationDto,
  ) {
    return this.authService.resendEmailVerification(
      resendEmailVerificationDto.email,
    );
  }
}
