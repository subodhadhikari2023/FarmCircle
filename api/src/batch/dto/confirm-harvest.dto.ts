import { IsNumber, IsPositive } from 'class-validator';

export class ConfirmHarvestDto {
  @IsNumber()
  @IsPositive()
  actualYield: number;
}
