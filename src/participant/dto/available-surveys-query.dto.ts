import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AvailableSurveysQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsIn(['ALL', 'HIGH_PAYING', 'SHORT_SURVEYS', 'TRENDING', 'NEW'])
  @IsOptional()
  tab?: 'ALL' | 'HIGH_PAYING' | 'SHORT_SURVEYS' | 'TRENDING' | 'NEW';

  @IsIn(['MOST_RELEVANT', 'REWARD_HIGH', 'REWARD_LOW', 'NEWEST', 'SHORTEST'])
  @IsOptional()
  sortBy?:
    | 'MOST_RELEVANT'
    | 'REWARD_HIGH'
    | 'REWARD_LOW'
    | 'NEWEST'
    | 'SHORTEST';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
