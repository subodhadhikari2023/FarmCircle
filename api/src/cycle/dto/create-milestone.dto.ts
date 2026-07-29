import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsInt()
  @Min(1)
  expectedDurationDays: number;
}
