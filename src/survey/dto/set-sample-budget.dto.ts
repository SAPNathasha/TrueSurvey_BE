import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  RewardDistributionType,
  SurveyBudgetCurrency,
} from '../../generated/prisma/enums';

export class SetSampleBudgetDto {
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  requiredResponses: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  totalBudget: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  platformCommissionPercentage: number;

  @IsEnum(RewardDistributionType)
  @IsOptional()
  rewardDistribution?: RewardDistributionType;

  @IsEnum(SurveyBudgetCurrency)
  @IsOptional()
  currency?: SurveyBudgetCurrency;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  budgetNotes?: string;
}
