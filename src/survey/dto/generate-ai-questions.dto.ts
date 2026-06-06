import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class GenerateAiQuestionsDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsString()
  @MaxLength(1000)
  description: string;

  @IsInt()
  @Min(1)
  @Max(50)
  maxNumberOfQuestions: number;
}
