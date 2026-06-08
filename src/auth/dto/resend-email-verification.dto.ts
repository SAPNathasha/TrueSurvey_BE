import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendEmailVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
