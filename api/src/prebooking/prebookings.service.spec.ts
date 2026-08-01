import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PreBookingsService } from './prebookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaymentsService } from '../payment/payments.service';
import { PreBookingStatus, Role } from 'generated/prisma/enums';

const decimal = (n: number) => ({ toNumber: () => n });

describe('PreBookingsService', () => {
  let service: PreBookingsService;

  const mockPrismaService = {
    batch: {
      findUnique: jest.fn(),
    },
    listing: {
      findFirst: jest.fn(),
    },
    preBooking: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRedisService = {
    reserveQueueCapacity: jest.fn(),
    releaseQueueCapacity: jest.fn(),
    clearPaymentHold: jest.fn(),
  };

  const mockPaymentsService = {
    createPreBookingPaymentIntent: jest.fn(),
    verifyPreBookingPayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreBookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<PreBookingsService>(PreBookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = { batchId: 'b1', quantity: 20 };
    const batch = {
      id: 'b1',
      harvestConfirmed: false,
      predictedYield: decimal(100),
    };
    const listing = { id: 'l1', preBookablePercent: decimal(60) };

    it('reserves capacity in Redis and creates a QUEUED pre-booking', async () => {
      mockPrismaService.batch.findUnique.mockResolvedValue(batch);
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);
      mockRedisService.reserveQueueCapacity.mockResolvedValue(true);
      const created = {
        id: 'pb1',
        vendorId: 'v1',
        batchId: 'b1',
        quantity: 20,
        status: PreBookingStatus.QUEUED,
      };
      mockPrismaService.preBooking.create.mockResolvedValue(created);

      const result = await service.create('v1', dto);

      expect(mockPrismaService.batch.findUnique).toHaveBeenCalledWith({
        where: { id: 'b1' },
      });
      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { batchId: 'b1' },
      });
      expect(mockRedisService.reserveQueueCapacity).toHaveBeenCalledWith(
        'b1',
        20,
        60,
      );
      expect(mockPrismaService.preBooking.create).toHaveBeenCalledWith({
        data: {
          vendorId: 'v1',
          batchId: 'b1',
          quantity: 20,
          status: PreBookingStatus.QUEUED,
        },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the batch does not exist', async () => {
      mockPrismaService.batch.findUnique.mockResolvedValue(null);

      await expect(service.create('v1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.preBooking.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the batch has already been harvested', async () => {
      mockPrismaService.batch.findUnique.mockResolvedValue({
        ...batch,
        harvestConfirmed: true,
      });

      await expect(service.create('v1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.preBooking.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when listing terms have not been set for the batch yet', async () => {
      mockPrismaService.batch.findUnique.mockResolvedValue(batch);
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(service.create('v1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.preBooking.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the Redis capacity reservation fails', async () => {
      mockPrismaService.batch.findUnique.mockResolvedValue(batch);
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);
      mockRedisService.reserveQueueCapacity.mockResolvedValue(false);

      await expect(service.create('v1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.preBooking.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllForUser', () => {
    it("returns only the vendor's own pre-bookings for a Vendor", async () => {
      mockPrismaService.preBooking.findMany.mockResolvedValue([]);

      await service.findAllForUser('v1', Role.VENDOR);

      expect(mockPrismaService.preBooking.findMany).toHaveBeenCalledWith({
        where: { vendorId: 'v1' },
        include: {
          batch: {
            include: {
              crop: { select: { name: true } },
              variety: { select: { name: true } },
            },
          },
        },
      });
    });

    it('returns all pre-bookings for an Admin', async () => {
      mockPrismaService.preBooking.findMany.mockResolvedValue([]);

      await service.findAllForUser('a1', Role.ADMIN);

      expect(mockPrismaService.preBooking.findMany).toHaveBeenCalledWith({
        include: {
          batch: {
            include: {
              crop: { select: { name: true } },
              variety: { select: { name: true } },
            },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    it('returns the pre-booking for its own Vendor, with crop/variety included', async () => {
      const preBooking = { id: 'pb1', vendorId: 'v1' };
      mockPrismaService.preBooking.findUnique.mockResolvedValue(preBooking);

      const result = await service.findOne('v1', Role.VENDOR, 'pb1');

      expect(mockPrismaService.preBooking.findUnique).toHaveBeenCalledWith({
        where: { id: 'pb1' },
        include: {
          batch: {
            include: {
              crop: { select: { name: true } },
              variety: { select: { name: true } },
            },
          },
        },
      });
      expect(result).toEqual(preBooking);
    });

    it('returns the pre-booking for an Admin regardless of vendor', async () => {
      const preBooking = { id: 'pb1', vendorId: 'v1' };
      mockPrismaService.preBooking.findUnique.mockResolvedValue(preBooking);

      const result = await service.findOne('a1', Role.ADMIN, 'pb1');

      expect(result).toEqual(preBooking);
    });

    it('throws NotFoundException when the pre-booking does not exist', async () => {
      mockPrismaService.preBooking.findUnique.mockResolvedValue(null);

      await expect(service.findOne('v1', Role.VENDOR, 'pb1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when a different Vendor requests it', async () => {
      mockPrismaService.preBooking.findUnique.mockResolvedValue({
        id: 'pb1',
        vendorId: 'v1',
      });

      await expect(service.findOne('v2', Role.VENDOR, 'pb1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancel', () => {
    it('cancels a QUEUED pre-booking and releases its Redis capacity', async () => {
      const preBooking = {
        id: 'pb1',
        vendorId: 'v1',
        batchId: 'b1',
        quantity: decimal(20),
        status: PreBookingStatus.QUEUED,
      };
      mockPrismaService.preBooking.findFirst.mockResolvedValue(preBooking);
      const updated = { ...preBooking, status: PreBookingStatus.CANCELLED };
      mockPrismaService.preBooking.update.mockResolvedValue(updated);

      const result = await service.cancel('v1', 'pb1');

      expect(mockPrismaService.preBooking.findFirst).toHaveBeenCalledWith({
        where: { id: 'pb1', vendorId: 'v1' },
      });
      expect(mockPrismaService.preBooking.update).toHaveBeenCalledWith({
        where: { id: 'pb1' },
        data: { status: PreBookingStatus.CANCELLED },
      });
      expect(mockRedisService.releaseQueueCapacity).toHaveBeenCalledWith(
        'b1',
        20,
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the pre-booking does not exist or is not owned by the vendor', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue(null);

      await expect(service.cancel('v1', 'pb1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.preBooking.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the pre-booking is no longer QUEUED', async () => {
      mockPrismaService.preBooking.findFirst.mockResolvedValue({
        id: 'pb1',
        vendorId: 'v1',
        batchId: 'b1',
        quantity: decimal(20),
        status: PreBookingStatus.AWAITING_PAYMENT,
      });

      await expect(service.cancel('v1', 'pb1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.preBooking.update).not.toHaveBeenCalled();
    });
  });

  describe('expireOverdueHolds', () => {
    it('expires overdue AWAITING_PAYMENT holds, releasing their Redis capacity and hold key', async () => {
      const overdue = {
        id: 'pb1',
        batchId: 'b1',
        quantity: decimal(20),
        status: PreBookingStatus.AWAITING_PAYMENT,
      };
      mockPrismaService.preBooking.findMany.mockResolvedValue([overdue]);

      await service.expireOverdueHolds();

      expect(mockPrismaService.preBooking.findMany).toHaveBeenCalledWith({
        where: {
          status: PreBookingStatus.AWAITING_PAYMENT,
          holdExpiresAt: { lt: expect.any(Date) as Date },
        },
      });
      expect(mockPrismaService.preBooking.update).toHaveBeenCalledWith({
        where: { id: 'pb1' },
        data: { status: PreBookingStatus.EXPIRED },
      });
      expect(mockRedisService.releaseQueueCapacity).toHaveBeenCalledWith(
        'b1',
        20,
      );
      expect(mockRedisService.clearPaymentHold).toHaveBeenCalledWith('pb1');
    });

    it('does nothing when there are no overdue holds', async () => {
      mockPrismaService.preBooking.findMany.mockResolvedValue([]);

      await service.expireOverdueHolds();

      expect(mockPrismaService.preBooking.update).not.toHaveBeenCalled();
      expect(mockRedisService.releaseQueueCapacity).not.toHaveBeenCalled();
    });
  });

  describe('createPaymentIntent', () => {
    it('delegates to paymentsService.createPreBookingPaymentIntent', async () => {
      const intent = { razorpayOrderId: 'order_abc', amount: 140 };
      mockPaymentsService.createPreBookingPaymentIntent.mockResolvedValue(
        intent,
      );

      const result = await service.createPaymentIntent('v1', 'pb1');

      expect(
        mockPaymentsService.createPreBookingPaymentIntent,
      ).toHaveBeenCalledWith('v1', 'pb1');
      expect(result).toEqual(intent);
    });
  });

  describe('verifyPayment', () => {
    it('delegates to paymentsService.verifyPreBookingPayment', async () => {
      const dto = {
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_xyz',
        razorpaySignature: 'sig',
      };
      const payment = { id: 'pay1', status: 'SUCCESS' };
      mockPaymentsService.verifyPreBookingPayment.mockResolvedValue(payment);

      const result = await service.verifyPayment('v1', 'pb1', dto);

      expect(mockPaymentsService.verifyPreBookingPayment).toHaveBeenCalledWith(
        'v1',
        'pb1',
        dto,
      );
      expect(result).toEqual(payment);
    });
  });
});
