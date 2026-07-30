import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SetListingTermsDto {
  @IsNumber()
  @IsPositive()
  retailPrice: number;

  @IsNumber()
  @IsPositive()
  wholesalePrice: number;

  @IsNumber()
  @IsPositive()
  minWholesaleQty: number;

  @IsNumber()
  @Min(5)
  @Max(20)
  retailCeilingPercent: number;

  @IsNumber()
  @Min(50)
  @Max(70)
  preBookablePercent: number;

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
