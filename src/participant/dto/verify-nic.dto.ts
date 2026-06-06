import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyNicDto {
  @IsString()
  @IsNotEmpty()
  nicNumber: string;
}
