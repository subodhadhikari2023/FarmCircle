import { IsEnum } from 'class-validator';
import { OrderStatus } from 'generated/prisma/enums';

export class DisputeOrderDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
