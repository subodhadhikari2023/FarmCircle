import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateActivityLogDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
