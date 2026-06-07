import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ParticipantWalletQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsIn(['ALL', 'COMPLETED', 'PENDING', 'PAID', 'WITHDRAWALS'])
  @IsOptional()
  status?: 'ALL' | 'COMPLETED' | 'PENDING' | 'PAID' | 'WITHDRAWALS';

  @IsIn(['MOST_RECENT', 'OLDEST', 'AMOUNT_HIGH', 'AMOUNT_LOW'])
  @IsOptional()
  sortBy?: 'MOST_RECENT' | 'OLDEST' | 'AMOUNT_HIGH' | 'AMOUNT_LOW';

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
