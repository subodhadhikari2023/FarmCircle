import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';
import { DeliveryMethod, PaymentMethod } from 'generated/prisma/enums';

export class CreateOrderDto {
  @IsString()
  listingId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsEnum(DeliveryMethod)
  deliveryMethod: DeliveryMethod;

  @ValidateIf(
    (dto: CreateOrderDto) => dto.deliveryMethod === DeliveryMethod.DELIVERY,
  )
  @IsString()
  addressId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
