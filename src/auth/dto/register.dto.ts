import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../generated/prisma/enums';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole, {
    message: 'role must be PARTICIPANT, CREATOR, or BOTH',
  })
  role: UserRole;

  @IsOptional()
  @IsString()
  nicNumber?: string;
}
