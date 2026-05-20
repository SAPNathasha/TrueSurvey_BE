import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum UserRole {
  PARTICIPANT = 'participant',
  SURVEY_CREATOR = 'survey_creator',
  BOTH = 'both',
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^\S*$/, {
    message: 'Username cannot contain spaces',
  })
  username: string | undefined;

  @IsEmail()
  email: string | undefined;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string | undefined;

  @IsEnum(UserRole, {
    message: 'Role must be participant, survey_creator, or both',
  })
  role: UserRole | undefined;
}
