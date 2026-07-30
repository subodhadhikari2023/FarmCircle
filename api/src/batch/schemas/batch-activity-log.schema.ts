import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BatchActivityLogDocument = HydratedDocument<BatchActivityLog>;

export type BatchActivityLogSource = 'manual' | 'ml_model' | 'iot_sensor';

@Schema({ timestamps: { createdAt: 'loggedAt', updatedAt: false } })
export class BatchActivityLog {
  @Prop({ required: true, index: true })
  batchId: string;

  @Prop()
  note?: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({
    enum: ['manual', 'ml_model', 'iot_sensor'],
    default: 'manual',
  })
  source: BatchActivityLogSource;

  loggedAt?: Date;
}

export const BatchActivityLogSchema =
  SchemaFactory.createForClass(BatchActivityLog);
