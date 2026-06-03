import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetSurveysQueryDto {
  @IsNotEmpty()
  @IsString()
  creatorId: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DRAFT', 'CLOSED'])
  status?: 'ACTIVE' | 'DRAFT' | 'CLOSED';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
