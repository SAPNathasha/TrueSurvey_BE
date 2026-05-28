import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from './prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../generated/prisma/enums';

type UploadedFile = {
  path: string;
};

type TokenPayload = {
  sub: string;
  role: UserRole;
};

type LoginResponse = {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
  };
};

type RefreshTokenResponse = {
  accessToken: string;
  refreshToken: string;
};

type SavedRefreshToken = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private getEnvValue(name: string, fallback: string): string {
    return process.env[name] ?? fallback;
  }

  private getJwtExpiresIn(name: string, fallback: string): JwtExpiresIn {
    return this.getEnvValue(name, fallback) as JwtExpiresIn;
  }

  async register(
    registerDto: RegisterDto,
    files?: {
      nicImage?: UploadedFile[];
      selfieImage?: UploadedFile[];
    },
  ) {
    const { username, email, password, role, nicNumber } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    let nicHash: string | null = null;

    if (nicNumber) {
      nicHash = this.hashNic(nicNumber);

      const existingNicUser = await this.prisma.user.findUnique({
        where: {
          nicHash,
        },
      });

      if (existingNicUser) {
        throw new ConflictException('This NIC is already registered');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const nicImagePath: string | null = files?.nicImage?.[0]?.path ?? null;
    const selfiePath: string | null = files?.selfieImage?.[0]?.path ?? null;

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        nicHash,
        nicImagePath,
        selfiePath,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        nicImagePath: true,
        selfiePath: true,
        createdAt: true,
      },
    });

    return {
      message: 'Registration successful',
      user,
    };
  }

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
      role: user.role,
    };

    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    await this.saveRefreshToken(user.id, refreshToken);

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
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
      include: {
        refreshTokens: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Access denied');
    }

    const validRefreshToken = await this.findMatchingRefreshToken(
      refreshToken,
      user.refreshTokens,
    );

    if (!validRefreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    if (validRefreshToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: {
          id: validRefreshToken.id,
        },
      });

      throw new UnauthorizedException('Refresh token expired');
    }

    const payload: TokenPayload = {
      sub: user.id,
      role: user.role,
    };

    const newAccessToken = await this.generateAccessToken(payload);
    const newRefreshToken = await this.generateRefreshToken(payload);

    await this.prisma.refreshToken.delete({
      where: {
        id: validRefreshToken.id,
      },
    });

    await this.saveRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
      },
    });

    return {
      message: 'Logout successful',
    };
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });
  }

  private async findMatchingRefreshToken(
    refreshToken: string,
    savedRefreshTokens: SavedRefreshToken[],
  ): Promise<SavedRefreshToken | null> {
    for (const savedToken of savedRefreshTokens) {
      const isMatched = await bcrypt.compare(
        refreshToken,
        savedToken.tokenHash,
      );

      if (isMatched) {
        return savedToken;
      }
    }

    return null;
  }

  private async generateAccessToken(payload: TokenPayload): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.getEnvValue('JWT_ACCESS_SECRET', 'access_secret'),
      expiresIn: this.getJwtExpiresIn('ACCESS_TOKEN_EXPIRES_IN', '5m'),
    };

    return this.jwtService.signAsync(payload, options);
  }

  private async generateRefreshToken(payload: TokenPayload): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.getEnvValue('JWT_REFRESH_SECRET', 'refresh_secret'),
      expiresIn: this.getJwtExpiresIn('REFRESH_TOKEN_EXPIRES_IN', '7d'),
    };

    return this.jwtService.signAsync(payload, options);
  }

  private hashNic(nicNumber: string): string {
    const secret = process.env.NIC_HASH_SECRET;

    if (!secret) {
      throw new Error('NIC_HASH_SECRET is missing in .env file');
    }

    const normalizedNic = nicNumber.trim().toUpperCase();

    return crypto
      .createHmac('sha256', secret)
      .update(normalizedNic)
      .digest('hex');
  }
}
