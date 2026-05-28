import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { TokenPayload } from './types/token-payload.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  private getBearerToken(request: Request): string {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Refresh token not found');
    }

    return authHeader.split(' ')[1];
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Access token is saved as an HTTP-only cookie
    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: false, // true in production with HTTPS
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000, // 5 minutes
    });

    // Refresh token is returned to frontend
    // Frontend should send it later as Bearer token
    return {
      message: result.message,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.getBearerToken(request);

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

    // New access token goes to cookie again
    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });

    return {
      message: 'Token refreshed successfully',
      refreshToken: result.refreshToken,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    let refreshToken: string | undefined;

    try {
      refreshToken = this.getBearerToken(request);
    } catch {
      refreshToken = undefined;
    }

    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<TokenPayload>(
          refreshToken,
          {
            secret: process.env.JWT_REFRESH_SECRET,
          },
        );

        await this.authService.logout(payload.sub);
      } catch {
        // Even if refresh token is invalid, clear access token cookie
      }
    }

    response.clearCookie('accessToken');

    return {
      message: 'Logout successful',
    };
  }
}
