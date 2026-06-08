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
import { IdVerificationStatus, UserRole } from '../generated/prisma/enums';
import { TokenPayload } from './types/token-payload.type';
import { IdentityVerificationQueue } from '../participant/identity-verification.queue';

type RegisterResponse = {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    isEmailVerified: boolean;
    nicImagePath: string | null;
    selfiePath: string | null;
    createdAt: Date;
  };
  emailVerification: {
    emailSent: boolean;
    isEmailVerified: boolean;
  };
  verification?: {
    nicNumberProvided: boolean;
    identityFrontImageUploaded: boolean;
    selfieImageUploaded: boolean;
    queueJobId: string | number | null;
    queueStatus: 'QUEUED' | 'SKIPPED' | 'QUEUE_FAILED';
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
    isEmailVerified: boolean;
  };
};

type RefreshTokenResponse = {
  accessToken: string;
};

type ResetPasswordResponse = {
  message: string;
};

type VerifyEmailResponse = {
  message: string;
  isEmailVerified: boolean;
};

type ResendEmailVerificationResponse = {
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
    private readonly identityVerificationQueue: IdentityVerificationQueue,
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
    const { username, password, role, nicNumber } = registerDto;
    const email = registerDto.email.trim().toLowerCase();

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
        isEmailVerified: false,
        idVerificationStatus:
          nicNumber?.trim() && nicImageUrl && selfieImageUrl
            ? IdVerificationStatus.PENDING
            : IdVerificationStatus.NOT_TRIED,
        isIdentityVerified: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isEmailVerified: true,
        nicImagePath: true,
        selfiePath: true,
        createdAt: true,
      },
    });

    let emailSent = false;

    try {
      await this.sendEmailVerificationLink(user.id, user.email);
      emailSent = true;
    } catch (error) {
      console.log('send email verification error:', error);
      emailSent = false;
    }

    const shouldQueueIdentityVerification = Boolean(
      nicNumber?.trim() && nicImageUrl && selfieImageUrl,
    );

    let verification: RegisterResponse['verification'] | undefined;

    if (shouldQueueIdentityVerification) {
      try {
        const verificationJob =
          await this.identityVerificationQueue.enqueueVerification({
            userId: user.id,
            nicNumber: nicNumber!.trim(),
            documentImageUrl: nicImageUrl!,
            selfieImageUrl: selfieImageUrl!,
          });

        verification = {
          nicNumberProvided: true,
          identityFrontImageUploaded: true,
          selfieImageUploaded: true,
          queueJobId: verificationJob.id ?? null,
          queueStatus: 'QUEUED',
        };
      } catch (error) {
        console.log('register identity verification queue error:', error);

        await this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            idVerificationStatus: IdVerificationStatus.NOT_TRIED,
            isIdentityVerified: false,
          },
        });

        verification = {
          nicNumberProvided: true,
          identityFrontImageUploaded: true,
          selfieImageUploaded: true,
          queueJobId: null,
          queueStatus: 'QUEUE_FAILED',
        };
      }
    } else if (nicNumber || nicImageUrl || selfieImageUrl) {
      verification = {
        nicNumberProvided: Boolean(nicNumber?.trim()),
        identityFrontImageUploaded: Boolean(nicImageUrl),
        selfieImageUploaded: Boolean(selfieImageUrl),
        queueJobId: null,
        queueStatus: 'SKIPPED',
      };
    }

    return {
      message: emailSent
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful, but verification email could not be sent. Please request a new verification email.',
      user,
      emailVerification: {
        emailSent,
        isEmailVerified: user.isEmailVerified,
      },
      ...(verification ? { verification } : {}),
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const email = loginDto.email.trim().toLowerCase();
    const { password } = loginDto;

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
        isEmailVerified: true,
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
      username: user.username,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
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
        isEmailVerified: user.isEmailVerified,
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
        role: true,
        isEmailVerified: true,
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
      username: user.username,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
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
    const successMessage =
      'If an account with that email exists, a password reset link has been sent.';

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
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

      /**
       * You can remove resetLink in production.
       * It is useful for testing in Postman during development.
       */
      resetLink,
    };
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

  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    const tokenHash = this.hashEmailVerificationToken(token);

    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: {
          tokenHash,
        },
      });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException(
        'Email verification token has already been used',
      );
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Email verification token has expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: verificationToken.userId,
        },
        data: {
          isEmailVerified: true,
        },
      }),

      this.prisma.emailVerificationToken.update({
        where: {
          id: verificationToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),

      /**
       * Optional cleanup:
       * Delete any other unused email verification tokens for this user.
       */
      this.prisma.emailVerificationToken.deleteMany({
        where: {
          userId: verificationToken.userId,
          usedAt: null,
          id: {
            not: verificationToken.id,
          },
        },
      }),
    ]);

    return {
      message: 'Email verified successfully',
      isEmailVerified: true,
    };
  }

  async resendEmailVerification(
    email: string,
  ): Promise<ResendEmailVerificationResponse> {
    const successMessage =
      'If an account with that email exists and is not verified, a verification email has been sent.';

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
      },
    });

    /**
     * Security behavior:
     * Do not reveal whether an email exists in the system.
     */
    if (!user) {
      return {
        message: successMessage,
      };
    }

    if (user.isEmailVerified) {
      return {
        message: 'This email is already verified',
      };
    }

    await this.sendEmailVerificationLink(user.id, user.email);

    return {
      message: successMessage,
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

  private async sendEmailVerificationLink(
    userId: string,
    email: string,
  ): Promise<void> {
    const rawToken = this.generateEmailVerificationToken();
    const tokenHash = this.hashEmailVerificationToken(rawToken);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    /**
     * Delete old unused verification tokens before creating a new one.
     */
    await this.prisma.emailVerificationToken.deleteMany({
      where: {
        userId,
        usedAt: null,
      },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new BadRequestException('FRONTEND_URL is missing in .env file');
    }

    const verificationLink = `${frontendUrl}/verify-email?token=${rawToken}`;

    await this.mailService.sendEmailVerificationEmail(email, verificationLink);
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

  private generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashEmailVerificationToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
