import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryController } from './inventory.controller';
import { InventoryQueryController } from './inventory-query.controller';
import { ListingsService } from './listings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import {
  ListingContent,
  ListingContentSchema,
} from './schemas/listing-content.schema';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: ListingContent.name, schema: ListingContentSchema },
    ]),
  ],
  controllers: [InventoryController, InventoryQueryController],
  providers: [ListingsService],
})
export class InventoryModule {}
