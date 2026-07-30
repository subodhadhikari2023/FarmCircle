import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ListingContentDocument = HydratedDocument<ListingContent>;

@Schema({ timestamps: true })
export class ListingContent {
  @Prop({ required: true, index: true })
  listingId: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: false })
  isOrganicCertified: boolean;

  @Prop({ type: Object })
  attributes?: Record<string, unknown>;
}

export const ListingContentSchema =
  SchemaFactory.createForClass(ListingContent);
