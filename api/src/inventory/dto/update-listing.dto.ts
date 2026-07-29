import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class UpdateListingDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  availableQuantity?: number;
}
