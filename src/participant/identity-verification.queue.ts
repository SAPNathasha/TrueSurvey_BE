import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import {
  IDENTITY_VERIFICATION_JOB,
  IDENTITY_VERIFICATION_QUEUE,
} from './verification.constants';
import type { IdentityVerificationJobData } from './verification.types';

@Injectable()
export class IdentityVerificationQueue {
  private readonly logger = new Logger(IdentityVerificationQueue.name);

  constructor(
    @InjectQueue(IDENTITY_VERIFICATION_QUEUE)
    private readonly queue: Queue<IdentityVerificationJobData>,
  ) {}

  async enqueueVerification(data: IdentityVerificationJobData) {
    try {
      this.logger.log(
        `Enqueuing identity verification job for user ${data.userId}`,
      );

      const job = await this.queue.add(IDENTITY_VERIFICATION_JOB, data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      });

      this.logger.log(
        `Identity verification job queued successfully for user ${data.userId}. Job ID: ${job.id}`,
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue identity verification job for user ${data.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
