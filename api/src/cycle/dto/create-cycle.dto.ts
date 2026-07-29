import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCycleDto {
  @IsString()
  @IsNotEmpty()
  cropId: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
