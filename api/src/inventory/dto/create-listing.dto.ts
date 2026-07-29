import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  cropId: string;

  @IsString()
  @IsNotEmpty()
  varietyId: string;

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

  @IsNumber()
  @IsPositive()
  availableQuantity: number;
}
