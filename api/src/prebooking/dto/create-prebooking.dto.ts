import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreatePreBookingDto {
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}
