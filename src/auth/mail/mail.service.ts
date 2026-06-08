import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost) {
      throw new Error('SMTP_HOST is missing in .env file');
    }

    if (!smtpUser) {
      throw new Error('SMTP_USER is missing in .env file');
    }

    if (!smtpPass) {
      throw new Error('SMTP_PASS is missing in .env file');
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Reset your TrueSurvey password',
      text: `
You requested to reset your TrueSurvey password.

Click this link to reset your password:
${resetLink}

This link will expire soon.

If you did not request this, you can ignore this email.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="color: #000957;">Reset your password</h2>

          <p>You requested to reset your TrueSurvey password.</p>

          <p>Please click the button below to reset your password.</p>

          <a 
            href="${resetLink}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background-color: #0015D6;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Reset Password
          </a>

          <p>If the button does not work, copy and paste this link into your browser:</p>

          <p style="word-break: break-all;">${resetLink}</p>

          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });
  }

  async sendEmailVerificationEmail(
    email: string,
    verificationLink: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Verify your TrueSurvey email address',
      text: `
Welcome to TrueSurvey.

Please verify your email address using this link:
${verificationLink}

This link will expire in 24 hours.

If you did not create a TrueSurvey account, you can ignore this email.
      `,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="color: #000957;">Verify your email address</h2>

          <p>Thank you for registering with TrueSurvey.</p>

          <p>Please click the button below to verify your email address.</p>

          <a 
            href="${verificationLink}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background-color: #0015D6;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Verify Email
          </a>

          <p>If the button does not work, copy and paste this link into your browser:</p>

          <p style="word-break: break-all;">${verificationLink}</p>

          <p>This link will expire in 24 hours.</p>

          <p>If you did not create a TrueSurvey account, you can ignore this email.</p>
        </div>
      `,
    });
  }
}
