import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';

import { ParticipantService } from './participant.service';
import { AvailableSurveysQueryDto } from './dto/available-surveys-query.dto';
import { ParticipantWalletQueryDto } from './dto/participant-wallet-query.dto';
import { SubmitSurveyDto } from './dto/submit-survey.dto';
import { TransactionRecordsQueryDto } from './dto/transaction-records-query.dto';
import { UpdateParticipantProfileDto } from './dto/update-participant-profile.dto';
import { VerifyNicDto } from './dto/verify-nic.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserRole } from '../generated/prisma/enums';

@Controller('participant')
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  getDashboard(@User('sub') participantId: string) {
    return this.participantService.getDashboard(participantId);
  }

  @Get('available-surveys')
  @UseGuards(JwtAuthGuard)
  getAvailableSurveys(
    @User('sub') participantId: string,
    @Query() query: AvailableSurveysQueryDto,
  ) {
    return this.participantService.getAvailableSurveys(query, participantId);
  }

  @Get('available-surveys/:surveyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.BOTH)
  getAvailableSurveyById(
    @Param('surveyId') surveyId: string,
    @User('sub') participantId: string,
  ) {
    return this.participantService.getAvailableSurveyById(
      participantId,
      surveyId,
    );
  }

  @Post('available-surveys/:surveyId/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.BOTH)
  submitSurvey(
    @Param('surveyId') surveyId: string,
    @User('sub') participantId: string,
    @Body() body: SubmitSurveyDto,
  ) {
    return this.participantService.submitSurvey(participantId, surveyId, body);
  }

  @Get('wallet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.PARTICIPANT, UserRole.BOTH)
  getWallet(
    @User('sub') userId: string,
    @Query() query: ParticipantWalletQueryDto,
  ) {
    return this.participantService.getWallet(userId, query);
  }

  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.BOTH)
  getSurveySubmissions(@User('sub') userId: string) {
    return this.participantService.getSurveySubmissions(userId);
  }

  @Delete('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARTICIPANT, UserRole.BOTH)
  deleteSurveySubmission(
    @User('sub') userId: string,
    @Query('submissionId') submissionId: string,
  ) {
    return this.participantService.deleteSurveySubmission(userId, submissionId);
  }

  @Post('transactions')
  @UseGuards(JwtAuthGuard)
  getTransactionRecords(
    @User('sub') userId: string,
    @Body() body: TransactionRecordsQueryDto,
  ) {
    return this.participantService.getTransactionRecords(userId, body);
  }

  @Get('profile-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.PARTICIPANT, UserRole.BOTH)
  getProfileSettings(@User('sub') userId: string) {
    return this.participantService.getProfileSettings(userId);
  }

  @Patch('profile-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.PARTICIPANT, UserRole.BOTH)
  updateProfileSettings(
    @User('sub') userId: string,
    @Body() body: UpdateParticipantProfileDto,
  ) {
    return this.participantService.updateProfileSettings(userId, body);
  }

  @Post('verify-nic')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'identityFrontImage', maxCount: 1 },
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
  verifyNic(
    @User('sub') userId: string,
    @Body() body: VerifyNicDto,
    @UploadedFiles()
    files: {
      identityFrontImage?: Express.Multer.File[];
      selfieImage?: Express.Multer.File[];
    },
  ) {
    return this.participantService.verifyNic(userId, body, files);
  }

  @Patch('settings/profile-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.PARTICIPANT, UserRole.BOTH)
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
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
    }),
  )
  updateProfilePhoto(
    @User('sub') userId: string,
    @UploadedFile() profilePhoto: Express.Multer.File,
  ) {
    return this.participantService.updateProfilePhoto(userId, profilePhoto);
  }
}
