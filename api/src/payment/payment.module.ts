import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayClient } from './razorpay-client.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import {
  OrderStatusHistory,
  OrderStatusHistorySchema,
} from '../order/schemas/order-status-history.schema';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: OrderStatusHistory.name, schema: OrderStatusHistorySchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayClient],
  exports: [PaymentsService],
})
export class PaymentModule {}
