import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaymentsService } from '../payment/payments.service';
import { CreatePreBookingDto } from './dto/create-prebooking.dto';
import { VerifyPaymentDto } from '../payment/dto/verify-payment.dto';
import { PreBookingStatus, Role } from 'generated/prisma/enums';

@Injectable()
export class PreBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly payments: PaymentsService,
  ) {}

  async create(vendorId: string, dto: CreatePreBookingDto) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: dto.batchId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    if (batch.harvestConfirmed) {
      throw new ConflictException('Batch has already been harvested');
    }

    const listing = await this.prisma.listing.findFirst({
      where: { batchId: dto.batchId },
    });
    if (!listing) {
      throw new NotFoundException('Listing terms not set for this batch yet');
    }

    const cap =
      batch.predictedYield.toNumber() *
      (listing.preBookablePercent.toNumber() / 100);
    const reserved = await this.redis.reserveQueueCapacity(
      batch.id,
      dto.quantity,
      cap,
    );
    if (!reserved) {
      throw new ConflictException(
        'Pre-booking would exceed the pre-bookable capacity for this batch',
      );
    }

    return this.prisma.preBooking.create({
      data: {
        vendorId,
        batchId: batch.id,
        quantity: dto.quantity,
        status: PreBookingStatus.QUEUED,
      },
    });
  }

  findAllForUser(userId: string, role: Role) {
    const include = {
      batch: {
        include: {
          crop: { select: { name: true } },
          variety: { select: { name: true } },
        },
      },
    };
    if (role === Role.ADMIN) {
      return this.prisma.preBooking.findMany({ include });
    }
    return this.prisma.preBooking.findMany({
      where: { vendorId: userId },
      include,
    });
  }

  async findOne(userId: string, role: Role, id: string) {
    const preBooking = await this.prisma.preBooking.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            crop: { select: { name: true } },
            variety: { select: { name: true } },
          },
        },
      },
    });
    if (!preBooking) {
      throw new NotFoundException('Pre-booking not found');
    }
    if (role !== Role.ADMIN && preBooking.vendorId !== userId) {
      throw new ForbiddenException('Not your pre-booking');
    }
    return preBooking;
  }

  async cancel(vendorId: string, id: string) {
    const preBooking = await this.prisma.preBooking.findFirst({
      where: { id, vendorId },
    });
    if (!preBooking) {
      throw new NotFoundException('Pre-booking not found');
    }
    if (preBooking.status !== PreBookingStatus.QUEUED) {
      throw new ConflictException(
        'Pre-booking can only be cancelled while queued',
      );
    }

    const updated = await this.prisma.preBooking.update({
      where: { id },
      data: { status: PreBookingStatus.CANCELLED },
    });

    await this.redis.releaseQueueCapacity(
      preBooking.batchId,
      preBooking.quantity.toNumber(),
    );

    return updated;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueHolds() {
    const overdue = await this.prisma.preBooking.findMany({
      where: {
        status: PreBookingStatus.AWAITING_PAYMENT,
        holdExpiresAt: { lt: new Date() },
      },
    });

    for (const preBooking of overdue) {
      // Guarded on status: if the Razorpay webhook confirmed this exact
      // pre-booking in the gap between the findMany read above and this
      // update, the guard matches zero rows and we must not release
      // capacity that's now actually committed to a real order.
      const { count } = await this.prisma.preBooking.updateMany({
        where: { id: preBooking.id, status: PreBookingStatus.AWAITING_PAYMENT },
        data: { status: PreBookingStatus.EXPIRED },
      });
      if (count === 0) {
        continue;
      }
      await this.redis.releaseQueueCapacity(
        preBooking.batchId,
        preBooking.quantity.toNumber(),
      );
      await this.redis.clearPaymentHold(preBooking.id);
    }
  }

  createPaymentIntent(vendorId: string, id: string) {
    return this.payments.createPreBookingPaymentIntent(vendorId, id);
  }

  verifyPayment(vendorId: string, id: string, dto: VerifyPaymentDto) {
    return this.payments.verifyPreBookingPayment(vendorId, id, dto);
  }
}
