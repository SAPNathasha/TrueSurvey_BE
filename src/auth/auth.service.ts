import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';

import { PrismaService } from './prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import type { TokenPayload } from './types/token-payload.type';

type LoginResponse = {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
};

type RefreshTokenResponse = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshTokenHash,
      },
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<RefreshTokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const isRefreshTokenMatched = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenMatched) {
      throw new UnauthorizedException('Access denied');
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = await this.generateAccessToken(payload);
    const newRefreshToken = await this.generateRefreshToken(payload);

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshTokenHash: newRefreshTokenHash,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: null,
      },
    });

    return {
      message: 'Logout successful',
    };
  }

  private async generateAccessToken(payload: TokenPayload): Promise<string> {
    const expiresIn: StringValue =
      (process.env.ACCESS_TOKEN_EXPIRES_IN as StringValue | undefined) ?? '15m';

    const options: JwtSignOptions = {
      secret: process.env.JWT_ACCESS_SECRET ?? 'access_secret',
      expiresIn,
    };

    return this.jwtService.signAsync(payload, options);
  }

  private async generateRefreshToken(payload: TokenPayload): Promise<string> {
    const expiresIn: StringValue =
      (process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue | undefined) ?? '7d';

    const options: JwtSignOptions = {
      secret: process.env.JWT_REFRESH_SECRET ?? 'refresh_secret',
      expiresIn,
    };

    return this.jwtService.signAsync(payload, options);
  }
}
