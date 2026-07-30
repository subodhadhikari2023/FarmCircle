import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderStatusHistoryDocument = HydratedDocument<OrderStatusHistory>;

@Schema()
export class OrderStatusHistory {
  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  status: string;

  @Prop()
  note?: string;

  @Prop()
  changedBy?: string;

  @Prop({ default: Date.now })
  changedAt: Date;
}

export const OrderStatusHistorySchema =
  SchemaFactory.createForClass(OrderStatusHistory);
