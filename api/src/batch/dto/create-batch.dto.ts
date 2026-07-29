import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  cropId: string;

  @IsString()
  @IsNotEmpty()
  varietyId: string;

  @IsString()
  @IsNotEmpty()
  cycleId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  predictedYield: number;
}
