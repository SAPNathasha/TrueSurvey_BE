import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';

import { ParticipantService } from './participant.service';
import { AvailableSurveysQueryDto } from './dto/available-surveys-query.dto';
import { ParticipantWalletQueryDto } from './dto/participant-wallet-query.dto';
import { UpdateParticipantProfileDto } from './dto/update-participant-profile.dto';

@Controller('participant')
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @Get('dashboard')
  getDashboard(@Query('participantId') participantId: string) {
    return this.participantService.getDashboard(participantId);
  }

  @Get('available-surveys')
  getAvailableSurveys(@Query() query: AvailableSurveysQueryDto) {
    return this.participantService.getAvailableSurveys(query);
  }

  @Get('wallet')
  getWallet(@Query() query: ParticipantWalletQueryDto) {
    return this.participantService.getWallet(query);
  }

  @Get('settings/profile')
  getProfileSettings(@Query('participantId') participantId: string) {
    return this.participantService.getProfileSettings(participantId);
  }

  @Patch('settings/profile')
  updateProfileSettings(@Body() body: UpdateParticipantProfileDto) {
    return this.participantService.updateProfileSettings(body);
  }

  @Patch('settings/profile-photo')
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
    @Body('participantId') participantId: string,
    @UploadedFile() profilePhoto: Express.Multer.File,
  ) {
    return this.participantService.updateProfilePhoto(
      participantId,
      profilePhoto,
    );
  }
}
