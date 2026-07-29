import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryQueryController } from './inventory-query.controller';
import { ListingsService } from './listings.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, InventoryQueryController],
  providers: [ListingsService],
})
export class InventoryModule {}
