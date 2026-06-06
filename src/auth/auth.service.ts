import {
  BadRequestException,
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
import { MailService } from './mail/mail.service';
import { UserRole } from '../generated/prisma/enums';
import { TokenPayload } from './types/token-payload.type';

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
};

type ResetPasswordResponse = {
  message: string;
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
    private readonly mailService: MailService,
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
      select: {
        id: true,
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
        select: {
          id: true,
        },
      });

      if (existingNicUser) {
        throw new ConflictException('This NIC is already registered');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

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
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        role: true,
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
      username: user.username,
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
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
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
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const newAccessToken = await this.generateAccessToken(payload);

    return {
      accessToken: newAccessToken,
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

  async forgotPassword(email: string) {
    try {
      const successMessage =
        'If an account with that email exists, a password reset link has been sent.';

      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          email: true,
        },
      });

      /**
       * Important security behavior:
       * Always return the same response, even if the email does not exist.
       * This prevents attackers from checking which emails are registered.
       */
      if (!user) {
        return {
          message: successMessage,
          resetLink: 'test',
        };
      }

      const rawToken = this.generatePasswordResetToken();
      const tokenHash = this.hashPasswordResetToken(rawToken);

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      /**
       * Optional cleanup:
       * Delete old unused reset tokens for this user before creating a new one.
       */
      await this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL;

      if (!frontendUrl) {
        throw new BadRequestException('FRONTEND_URL is missing in .env file');
      }

      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      await this.mailService.sendPasswordResetEmail(user.email, resetLink);

      return {
        message: successMessage,
        resetLink,
      };
    } catch (err) {
      console.log(err);
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ResetPasswordResponse> {
    const tokenHash = this.hashPasswordResetToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          password: hashedPassword,
        },
      }),

      this.prisma.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),

      /**
       * Important:
       * Remove old refresh tokens so old logged-in sessions are invalidated
       * after password reset.
       */
      this.prisma.refreshToken.deleteMany({
        where: {
          userId: resetToken.userId,
        },
      }),
    ]);

    return {
      message: 'Password has been reset successfully',
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

  private generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashPasswordResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
