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
import { StorageService } from './storage/storage.service';
import { UserRole } from '../generated/prisma/enums';

type TokenPayload = {
  sub: string;
  role: UserRole;
};

type RegisterResponse = {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    nicImagePath: string | null;
    selfiePath: string | null;
    createdAt: Date;
  };
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
    private readonly storageService: StorageService,
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
      nicImage?: Express.Multer.File[];
      selfieImage?: Express.Multer.File[];
    },
  ): Promise<RegisterResponse> {
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

    /**
     * We create the user ID before saving the user.
     * This allows us to upload files into a clean folder structure:
     *
     * users/{userId}/verification/nic/...
     * users/{userId}/verification/selfie/...
     */
    const userId = crypto.randomUUID();

    const nicImage = files?.nicImage?.[0];
    const selfieImage = files?.selfieImage?.[0];

    let nicImageUrl: string | null = null;
    let selfieImageUrl: string | null = null;

    if (nicImage) {
      nicImageUrl = await this.storageService.uploadImage(
        nicImage,
        `users/${userId}/verification/nic`,
      );
    }

    if (selfieImage) {
      selfieImageUrl = await this.storageService.uploadImage(
        selfieImage,
        `users/${userId}/verification/selfie`,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        username,
        email,
        password: hashedPassword,
        role,
        nicHash,
        nicImagePath: nicImageUrl,
        selfiePath: selfieImageUrl,
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
