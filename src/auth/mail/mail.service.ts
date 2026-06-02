import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      throw new Error('SMTP environment variables are missing');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Reset your TrueSurvey password',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Reset your TrueSurvey password</h2>
            <p>You requested to reset your password.</p>
            <p>Click the button below to create a new password:</p>

            <p>
              <a href="${resetLink}" 
                 style="display: inline-block; padding: 10px 16px; background: #0015D6; color: white; text-decoration: none; border-radius: 6px;">
                Reset Password
              </a>
            </p>

            <p>This link will expire in 15 minutes.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException('Failed to send reset email');
    }
  }
}
