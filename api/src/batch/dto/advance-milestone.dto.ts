import { IsDateString } from 'class-validator';

export class AdvanceMilestoneDto {
  @IsDateString()
  reachedAt: string;
}
