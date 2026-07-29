import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCropDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
