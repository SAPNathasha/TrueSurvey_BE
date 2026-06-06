import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
} from 'class-validator';

export class BulkReviewSubmissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  submissionIds: string[];
}
