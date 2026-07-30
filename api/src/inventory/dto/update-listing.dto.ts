import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateListingDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  availableQuantity?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isOrganicCertified?: boolean;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
