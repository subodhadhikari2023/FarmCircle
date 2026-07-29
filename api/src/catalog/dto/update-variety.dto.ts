import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateVarietyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
