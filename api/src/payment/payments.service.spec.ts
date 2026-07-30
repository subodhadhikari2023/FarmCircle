import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RazorpayClient } from './razorpay-client.service';
import { getModelToken } from '@nestjs/mongoose';
import { OrderStatusHistory } from '../order/schemas/order-status-history.schema';
import {
  PreBookingStatus,
  PaymentStatus,
  PaymentMethod,
  DeliveryMethod,
} from 'generated/prisma/enums';

const decimal = (n: number) => ({ toNumber: () => n });
const KEY_SECRET = 'test-key-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPrismaService = {
    preBooking: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    listing: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRedisService = {
    clearPaymentHold: jest.fn(),
  };

  const mockRazorpayClient = {
    createOrder: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'RAZORPAY_KEY_SECRET') return KEY_SECRET;
      if (key === 'RAZORPAY_WEBHOOK_SECRET') return WEBHOOK_SECRET;
      if (key === 'RAZORPAY_KEY_ID') return 'test-key-id';
      throw new Error(`unexpected config key ${key}`);
    }),
  };

  const mockHistoryModel = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RazorpayClient, useValue: mockRazorpayClient },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getModelToken(OrderStatusHistory.name),
          useValue: mockHistoryModel,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPreBookingPaymentIntent', () => {
    const preBooking = {
      id: 'pb1',
      vendorId: 'v1',
      status: PreBookingStatus.AWAITING_PAYMENT,
      advanceAmount: decimal(140),
    };

    it('throws NotFoundException when the pre-booking is not owned by the vendor', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.createPreBookingPaymentIntent('v1', 'pb1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the pre-booking is not AWAITING_PAYMENT', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue({
        ...preBooking,
        status: PreBookingStatus.QUEUED,
      });

      await expect(
        service.createPreBookingPaymentIntent('v1', 'pb1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when the pre-booking has already been paid', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue(preBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay1',
        status: PaymentStatus.SUCCESS,
      });

      await expect(
        service.createPreBookingPaymentIntent('v1', 'pb1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a Payment row and a Razorpay order when none exists yet', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue(preBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue({
        id: 'pay1',
        preBookingId: 'pb1',
        amount: decimal(140),
        status: PaymentStatus.PENDING,
        razorpayOrderId: null,
      });
      mockRazorpayClient.createOrder.mockResolvedValue({
        id: 'order_abc',
        amount: 14000,
        currency: 'INR',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        id: 'pay1',
        amount: decimal(140),
        razorpayOrderId: 'order_abc',
      });

      const result = await service.createPreBookingPaymentIntent('v1', 'pb1');

      expect(mockPrismaService.payment.create).toHaveBeenCalledWith({
        data: {
          preBookingId: 'pb1',
          amount: 140,
          method: PaymentMethod.ONLINE,
          status: PaymentStatus.PENDING,
        },
      });
      expect(mockRazorpayClient.createOrder).toHaveBeenCalledWith(14000, 'pb1');
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: { razorpayOrderId: 'order_abc' },
      });
      expect(result).toEqual({
        razorpayOrderId: 'order_abc',
        amount: 140,
        currency: 'INR',
        keyId: 'test-key-id',
      });
    });

    it('reuses an existing pending Payment and Razorpay order without recreating either', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue(preBooking);
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay1',
        amount: decimal(140),
        status: PaymentStatus.PENDING,
        razorpayOrderId: 'order_abc',
      });

      const result = await service.createPreBookingPaymentIntent('v1', 'pb1');

      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
      expect(mockRazorpayClient.createOrder).not.toHaveBeenCalled();
      expect(result).toEqual({
        razorpayOrderId: 'order_abc',
        amount: 140,
        currency: 'INR',
        keyId: 'test-key-id',
      });
    });
  });

  describe('verifyPreBookingPayment', () => {
    const dto = {
      razorpayOrderId: 'order_abc',
      razorpayPaymentId: 'pay_xyz',
      razorpaySignature: '',
    };

    beforeEach(() => {
      dto.razorpaySignature = createHmac('sha256', KEY_SECRET)
        .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
        .digest('hex');
    });

    it('throws NotFoundException when the pre-booking is not owned by the vendor', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyPreBookingPayment('v1', 'pb1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when there is no matching payment intent', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue({
        id: 'pb1',
        vendorId: 'v1',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyPreBookingPayment('v1', 'pb1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the signature is invalid', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue({
        id: 'pb1',
        vendorId: 'v1',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay1',
        razorpayOrderId: 'order_abc',
      });

      await expect(
        service.verifyPreBookingPayment('v1', 'pb1', {
          ...dto,
          razorpaySignature: 'tampered',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('marks the Payment SUCCESS when the signature is valid', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue({
        id: 'pb1',
        vendorId: 'v1',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay1',
        razorpayOrderId: 'order_abc',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        id: 'pay1',
        status: PaymentStatus.SUCCESS,
      });

      const result = await service.verifyPreBookingPayment('v1', 'pb1', dto);

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: {
          razorpayPaymentId: dto.razorpayPaymentId,
          razorpaySignature: dto.razorpaySignature,
          status: PaymentStatus.SUCCESS,
        },
      });
      expect(result).toEqual({ id: 'pay1', status: PaymentStatus.SUCCESS });
    });
  });

  describe('handleWebhook', () => {
    const buildBody = (orderId: string, paymentId: string) =>
      JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
      });

    const sign = (body: string) =>
      createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

    it('throws BadRequestException when the webhook signature is invalid', async () => {
      const body = buildBody('order_abc', 'pay_xyz');

      await expect(
        service.handleWebhook(body, 'tampered-signature'),
      ).rejects.toThrow(BadRequestException);
    });

    it('acks unrecognized events without touching the database', async () => {
      const body = JSON.stringify({ event: 'payment.failed', payload: {} });

      const result = await service.handleWebhook(body, sign(body));

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.payment.findFirst).not.toHaveBeenCalled();
    });

    it('acks when no Payment matches the razorpayOrderId', async () => {
      const body = buildBody('order_unknown', 'pay_xyz');
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhook(body, sign(body));

      expect(result).toEqual({ received: true });
    });

    it('acks idempotently when the pre-booking is no longer AWAITING_PAYMENT', async () => {
      const body = buildBody('order_abc', 'pay_xyz');
      mockPrismaService.payment.findFirst.mockResolvedValue({
        id: 'pay1',
        preBookingId: 'pb1',
      });
      mockPrismaService.preBooking.findUnique.mockResolvedValue({
        id: 'pb1',
        status: PreBookingStatus.CONFIRMED,
      });

      const result = await service.handleWebhook(body, sign(body));

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('confirms the pre-booking, creates the Order, decrements stock, and clears the Redis hold', async () => {
      const body = buildBody('order_abc', 'pay_xyz');
      mockPrismaService.payment.findFirst.mockResolvedValue({
        id: 'pay1',
        preBookingId: 'pb1',
      });
      const preBooking = {
        id: 'pb1',
        vendorId: 'v1',
        listingId: 'l1',
        quantity: decimal(40),
        status: PreBookingStatus.AWAITING_PAYMENT,
      };
      mockPrismaService.preBooking.findUnique.mockResolvedValue(preBooking);
      const listing = {
        id: 'l1',
        wholesalePrice: decimal(35),
        availableQuantity: decimal(100),
      };
      mockPrismaService.listing.findUniqueOrThrow.mockResolvedValue(listing);

      const createdOrder = { id: 'order1', status: 'PLACED' };
      mockPrismaService.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrismaService) => Promise<unknown>) => {
          mockPrismaService.order.create.mockResolvedValue(createdOrder);
          return cb(mockPrismaService);
        },
      );

      const result = await service.handleWebhook(body, sign(body));

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: { razorpayPaymentId: 'pay_xyz', status: PaymentStatus.SUCCESS },
      });
      expect(mockPrismaService.preBooking.update).toHaveBeenCalledWith({
        where: { id: 'pb1' },
        data: { status: PreBookingStatus.CONFIRMED },
      });
      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'v1',
          listingId: 'l1',
          quantity: preBooking.quantity,
          unitPrice: listing.wholesalePrice,
          totalAmount: 1400,
          deliveryMethod: DeliveryMethod.PICKUP,
          paymentMethod: PaymentMethod.ONLINE,
          preBookingId: 'pb1',
        },
      });
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { availableQuantity: 60 },
      });
      expect(mockHistoryModel.create).toHaveBeenCalledWith({
        orderId: 'order1',
        status: 'PLACED',
        changedBy: 'v1',
      });
      expect(mockRedisService.clearPaymentHold).toHaveBeenCalledWith('pb1');
      expect(result).toEqual({ received: true });
    });
  });
});
