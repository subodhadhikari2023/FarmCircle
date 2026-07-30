import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import {
  OrderStatusHistory,
  OrderStatusHistorySchema,
} from './schemas/order-status-history.schema';

@Module({
  imports: [
    PrismaModule,
    MongooseModule.forFeature([
      { name: OrderStatusHistory.name, schema: OrderStatusHistorySchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrderModule {}
