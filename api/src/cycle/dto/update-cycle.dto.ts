import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCycleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
