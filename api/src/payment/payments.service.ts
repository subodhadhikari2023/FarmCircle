import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { Order, Prisma } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RazorpayClient } from './razorpay-client.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  OrderStatusHistory,
  OrderStatusHistoryDocument,
} from '../order/schemas/order-status-history.schema';
import {
  DeliveryMethod,
  PaymentMethod,
  PaymentStatus,
  PreBookingStatus,
} from 'generated/prisma/enums';

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
      };
    };
  };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly razorpay: RazorpayClient,
    private readonly configService: ConfigService,
    @InjectModel(OrderStatusHistory.name)
    private readonly historyModel: Model<OrderStatusHistoryDocument>,
  ) {}

  private keyId(): string {
    return this.configService.getOrThrow<string>('RAZORPAY_KEY_ID');
  }

  private keySecret(): string {
    return this.configService.getOrThrow<string>('RAZORPAY_KEY_SECRET');
  }

  private webhookSecret(): string {
    return this.configService.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
  }

  async createPreBookingPaymentIntent(vendorId: string, preBookingId: string) {
    const preBooking = await this.prisma.preBooking.findFirst({
      where: { id: preBookingId, vendorId },
    });
    if (!preBooking) {
      throw new NotFoundException('Pre-booking not found');
    }
    if (preBooking.status !== PreBookingStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Payment intent is only available once the pre-booking is awaiting payment',
      );
    }

    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: preBooking.listingId! },
    });
    if (listing.isClosed) {
      throw new ConflictException(
        'This listing has been closed and can no longer be paid for',
      );
    }

    let payment = await this.prisma.payment.findUnique({
      where: { preBookingId },
    });
    if (payment?.status === PaymentStatus.SUCCESS) {
      throw new ConflictException('This pre-booking has already been paid');
    }

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          preBookingId,
          amount: preBooking.advanceAmount!.toNumber(),
          method: PaymentMethod.ONLINE,
          status: PaymentStatus.PENDING,
        },
      });
    }

    if (!payment.razorpayOrderId) {
      const razorpayOrder = await this.razorpay.createOrder(
        Math.round(payment.amount.toNumber() * 100),
        preBooking.id,
      );
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { razorpayOrderId: razorpayOrder.id },
      });
    }

    return {
      razorpayOrderId: payment.razorpayOrderId,
      amount: payment.amount.toNumber(),
      currency: 'INR',
      keyId: this.keyId(),
    };
  }

  async verifyPreBookingPayment(
    vendorId: string,
    preBookingId: string,
    dto: VerifyPaymentDto,
  ) {
    const preBooking = await this.prisma.preBooking.findFirst({
      where: { id: preBookingId, vendorId },
    });
    if (!preBooking) {
      throw new NotFoundException('Pre-booking not found');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { preBookingId },
    });
    if (!payment || payment.razorpayOrderId !== dto.razorpayOrderId) {
      throw new BadRequestException(
        'No matching payment intent for this pre-booking',
      );
    }

    const expectedSignature = createHmac('sha256', this.keySecret())
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');
    if (!safeEqual(expectedSignature, dto.razorpaySignature)) {
      throw new BadRequestException('Invalid payment signature');
    }

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
        status: PaymentStatus.SUCCESS,
      },
    });
  }

  async handleWebhook(rawBody: string, signature: string) {
    const expectedSignature = createHmac('sha256', this.webhookSecret())
      .update(rawBody)
      .digest('hex');
    if (!safeEqual(expectedSignature, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    if (event.event !== 'payment.captured') {
      return { received: true };
    }

    const { order_id: razorpayOrderId, id: razorpayPaymentId } =
      event.payload.payment.entity;

    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId },
    });
    if (!payment) {
      return { received: true };
    }

    if (payment.orderIntentId) {
      return this.confirmOrderIntentPayment(payment, razorpayPaymentId);
    }

    if (!payment.preBookingId) {
      return { received: true };
    }

    const preBooking = await this.prisma.preBooking.findUnique({
      where: { id: payment.preBookingId },
    });
    if (!preBooking) {
      return { received: true };
    }
    if (preBooking.status === PreBookingStatus.CONFIRMED) {
      // Already processed by an earlier delivery of this same webhook
      // event (Razorpay retries on timeout) — idempotent no-op.
      return { received: true };
    }
    if (preBooking.status !== PreBookingStatus.AWAITING_PAYMENT) {
      // EXPIRED/CANCELLED: the 48h cron sweep (or a manual path) already
      // moved this pre-booking on before the webhook arrived. Razorpay has
      // genuinely captured the money, so record that honestly instead of
      // leaving the Payment stuck PENDING forever — but no Order can be
      // created since the hold/capacity was already released. This is a
      // manual-reconciliation case (refund or manual order), the same
      // class of gap as the OrderIntent stock-race below, not auto-solved.
      return this.recordCapturedPaymentWithoutOrder(
        payment.id,
        razorpayPaymentId,
      );
    }

    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: preBooking.listingId! },
    });
    if (listing.isClosed) {
      return this.recordCapturedPaymentWithoutOrder(
        payment.id,
        razorpayPaymentId,
      );
    }

    let order: Order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { razorpayPaymentId, status: PaymentStatus.SUCCESS },
        });
        // Guarded on status so a concurrent cron expiry can't be silently
        // overwritten back to CONFIRMED after having already released
        // capacity, and guarded on stock/isClosed so this can't oversell
        // or sell against a listing the Grower has since closed.
        await tx.preBooking.update({
          where: {
            id: preBooking.id,
            status: PreBookingStatus.AWAITING_PAYMENT,
          },
          data: { status: PreBookingStatus.CONFIRMED },
        });
        const createdOrder = await tx.order.create({
          data: {
            buyerId: preBooking.vendorId,
            listingId: listing.id,
            quantity: preBooking.quantity,
            unitPrice: listing.wholesalePrice,
            totalAmount:
              preBooking.quantity.toNumber() *
              listing.wholesalePrice.toNumber(),
            deliveryMethod: DeliveryMethod.PICKUP,
            paymentMethod: PaymentMethod.ONLINE,
            preBookingId: preBooking.id,
          },
        });
        await tx.listing.update({
          where: {
            id: listing.id,
            isClosed: false,
            availableQuantity: { gte: preBooking.quantity.toNumber() },
          },
          data: {
            availableQuantity: { decrement: preBooking.quantity.toNumber() },
          },
        });
        return createdOrder;
      });
    } catch (err) {
      if (this.isRecordNotFound(err)) {
        return this.recordCapturedPaymentWithoutOrder(
          payment.id,
          razorpayPaymentId,
        );
      }
      throw err;
    }

    await this.historyModel.create({
      orderId: order.id,
      status: order.status,
      changedBy: preBooking.vendorId,
    });
    await this.redis.clearPaymentHold(preBooking.id);

    return { received: true };
  }

  private isRecordNotFound(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    );
  }

  // Records that Razorpay genuinely captured the money even though no
  // Order could be created (the hold expired, the listing closed, or
  // stock ran out concurrently) — leaving the Payment PENDING would hide
  // that money was taken. This is intentionally not auto-resolved further
  // (no auto-refund, no auto-order); it's a flagged manual-reconciliation
  // case, same as the OrderIntent stock-race gap.
  private async recordCapturedPaymentWithoutOrder(
    paymentId: string,
    razorpayPaymentId: string,
  ) {
    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { not: PaymentStatus.SUCCESS } },
      data: { razorpayPaymentId, status: PaymentStatus.SUCCESS },
    });
    return { received: true };
  }

  private async confirmOrderIntentPayment(
    payment: {
      id: string;
      orderId: string | null;
      orderIntentId: string | null;
    },
    razorpayPaymentId: string,
  ) {
    if (payment.orderId) {
      return { received: true };
    }

    const intent = await this.prisma.orderIntent.findUnique({
      where: { id: payment.orderIntentId! },
    });
    if (!intent) {
      return { received: true };
    }

    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: intent.listingId },
    });
    if (listing.availableQuantity.toNumber() < intent.quantity.toNumber()) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { razorpayPaymentId, status: PaymentStatus.SUCCESS },
      });
      return { received: true };
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          buyerId: intent.buyerId,
          listingId: intent.listingId,
          quantity: intent.quantity,
          unitPrice: intent.unitPrice,
          totalAmount: intent.totalAmount,
          deliveryMethod: intent.deliveryMethod,
          addressId: intent.addressId,
          paymentMethod: intent.paymentMethod,
        },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: PaymentStatus.SUCCESS,
          orderId: createdOrder.id,
        },
      });
      await tx.listing.update({
        where: { id: listing.id },
        data: {
          availableQuantity:
            listing.availableQuantity.toNumber() - intent.quantity.toNumber(),
        },
      });
      return createdOrder;
    });

    await this.historyModel.create({
      orderId: order.id,
      status: order.status,
      changedBy: intent.buyerId,
    });

    return { received: true };
  }

  async createOrderIntentPayment(orderIntentId: string, amount: number) {
    const razorpayOrder = await this.razorpay.createOrder(
      Math.round(amount * 100),
      orderIntentId,
    );
    const payment = await this.prisma.payment.create({
      data: {
        orderIntentId,
        amount,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        razorpayOrderId: razorpayOrder.id,
      },
    });

    return {
      orderIntentId,
      razorpayOrderId: payment.razorpayOrderId,
      amount: payment.amount.toNumber(),
      currency: 'INR',
      keyId: this.keyId(),
    };
  }

  async verifyOrderIntentPayment(
    userId: string,
    orderIntentId: string,
    dto: VerifyPaymentDto,
  ) {
    const intent = await this.prisma.orderIntent.findFirst({
      where: { id: orderIntentId, buyerId: userId },
    });
    if (!intent) {
      throw new NotFoundException('Order intent not found');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderIntentId },
    });
    if (!payment || payment.razorpayOrderId !== dto.razorpayOrderId) {
      throw new BadRequestException(
        'No matching payment intent for this order',
      );
    }

    const expectedSignature = createHmac('sha256', this.keySecret())
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');
    if (!safeEqual(expectedSignature, dto.razorpaySignature)) {
      throw new BadRequestException('Invalid payment signature');
    }

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
        status: PaymentStatus.SUCCESS,
      },
    });
  }
}
