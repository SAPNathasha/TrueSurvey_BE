import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetSurveysQueryDto {
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
