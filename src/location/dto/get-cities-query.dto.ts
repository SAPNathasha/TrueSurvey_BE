import { IsNotEmpty, IsString } from 'class-validator';

export class GetCitiesQueryDto {
  @IsString()
  @IsNotEmpty()
  districtId: string;
}
