import { Module } from '@nestjs/common';
import { PreBookingsController } from './prebookings.controller';
import { PreBookingsService } from './prebookings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PrismaModule, RedisModule, PaymentModule],
  controllers: [PreBookingsController],
  providers: [PreBookingsService],
})
export class PreBookingModule {}
