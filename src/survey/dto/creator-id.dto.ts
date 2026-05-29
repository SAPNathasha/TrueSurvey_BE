import { IsNotEmpty, IsString } from 'class-validator';

export class CreatorIdDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;
}
