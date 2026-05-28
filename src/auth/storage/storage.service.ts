import { BadRequestException, Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT;
    const accessKeyId = process.env.MINIO_ACCESS_KEY;
    const secretAccessKey = process.env.MINIO_SECRET_KEY;
    const region = process.env.MINIO_REGION ?? 'us-east-1';
    const bucketName = process.env.MINIO_BUCKET_NAME;
    const publicUrl = process.env.MINIO_PUBLIC_URL;

    if (!endpoint) {
      throw new Error('MINIO_ENDPOINT is missing in .env file');
    }

    if (!accessKeyId) {
      throw new Error('MINIO_ACCESS_KEY is missing in .env file');
    }

    if (!secretAccessKey) {
      throw new Error('MINIO_SECRET_KEY is missing in .env file');
    }

    if (!bucketName) {
      throw new Error('MINIO_BUCKET_NAME is missing in .env file');
    }

    if (!publicUrl) {
      throw new Error('MINIO_PUBLIC_URL is missing in .env file');
    }

    this.bucketName = bucketName;
    this.publicUrl = publicUrl;

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const fileExtension = extname(file.originalname);
    const fileName = `${randomUUID()}${fileExtension}`;
    const objectKey = `${folder}/${fileName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${this.publicUrl}/${objectKey}`;
  }
}
