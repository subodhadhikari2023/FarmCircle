import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  addressText: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}
