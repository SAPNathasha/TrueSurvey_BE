import { IsNotEmpty, IsString } from 'class-validator';

export class GetDistrictsQueryDto {
  @IsString()
  @IsNotEmpty()
  provinceId: string;
}
