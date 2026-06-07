import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { PrismaService } from '../auth/prisma/prisma.service';
import { IdVerificationStatus } from '../generated/prisma/enums';
import {
  IDENTITY_VERIFICATION_JOB,
  IDENTITY_VERIFICATION_QUEUE,
} from './verification.constants';
import type {
  IdentityVerificationJobData,
  IdentityVerificationServiceResponse,
} from './verification.types';

@Injectable()
@Processor(IDENTITY_VERIFICATION_QUEUE)
export class IdentityVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(IdentityVerificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<IdentityVerificationJobData>) {
    try {
      this.logger.log(
        `Identity verification processor received job ${job.id} with name ${job.name} for user ${job.data.userId}`,
      );

      if (job.name !== IDENTITY_VERIFICATION_JOB) {
        this.logger.warn(
          `Skipping unsupported job ${job.id} with name ${job.name}`,
        );
        return;
      }

      const verificationResponse = await this.requestVerification(job.data);

      this.logger.log(
        `Verification service responded for user ${job.data.userId}: ${JSON.stringify(verificationResponse)}`,
      );

      const isVerified = verificationResponse.verificationStatus === 'VERIFIED';

      await this.prisma.user.update({
        where: {
          id: job.data.userId,
        },
        data: {
          idVerificationStatus: isVerified
            ? IdVerificationStatus.ACCEPTED
            : IdVerificationStatus.REJECTED,
          isIdentityVerified: isVerified,
        },
      });

      this.logger.log(
        `Updated verification status for user ${job.data.userId}: isIdentityVerified=${isVerified}`,
      );

      return verificationResponse;
    } catch (error) {
      this.logger.error(
        `Identity verification job ${job.id} failed for user ${job.data.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async requestVerification(data: IdentityVerificationJobData) {
    try {
      const baseUrl =
        process.env.IDENTITY_VERIFICATION_SERVICE_BASE_URL ??
        'http://127.0.0.1:8001';
      const apiKey = process.env.FASTAPI_API_KEY;
      const endpoint = `${baseUrl.replace(/\/$/, '')}/api/v1/verification/face-match`;

      if (!apiKey) {
        throw new Error('FASTAPI_API_KEY is missing in environment variables');
      }

      this.logger.log(
        `Sending identity verification request for user ${data.userId} to ${endpoint}. API key configured: yes`,
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();

        this.logger.error(
          `Identity verification service returned status ${response.status} for user ${data.userId}: ${errorText}`,
        );

        throw new Error(
          `Identity verification service failed with status ${response.status}: ${errorText}`,
        );
      }

      const result =
        (await response.json()) as IdentityVerificationServiceResponse;

      return result;
    } catch (error) {
      this.logger.error(
        `Failed while requesting identity verification for user ${data.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
