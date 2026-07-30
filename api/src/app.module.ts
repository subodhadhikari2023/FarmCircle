import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { CycleModule } from './cycle/cycle.module';
import { BatchModule } from './batch/batch.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrderModule } from './order/order.module';
import { PreBookingModule } from './prebooking/prebooking.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URL as string),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CycleModule,
    BatchModule,
    InventoryModule,
    OrderModule,
    PreBookingModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
