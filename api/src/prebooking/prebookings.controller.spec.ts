import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { PreBookingsController } from './prebookings.controller';
import { PreBookingsService } from './prebookings.service';
import { Role } from 'generated/prisma/enums';

describe('PreBookingsController', () => {
  let controller: PreBookingsController;

  const mockPreBookingsService = {
    create: jest.fn(),
    findAllForUser: jest.fn(),
    findOne: jest.fn(),
    cancel: jest.fn(),
    createPaymentIntent: jest.fn(),
    verifyPayment: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'v1', role: Role.VENDOR },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreBookingsController],
      providers: [
        { provide: PreBookingsService, useValue: mockPreBookingsService },
      ],
    }).compile();

    controller = module.get<PreBookingsController>(PreBookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to preBookingsService.create with the authenticated user's id and dto", async () => {
      const dto = { batchId: 'b1', quantity: 20 };
      const preBooking = { id: 'pb1', vendorId: 'v1', ...dto };
      mockPreBookingsService.create.mockResolvedValue(preBooking);

      const result = await controller.create(mockRequest, dto);

      expect(mockPreBookingsService.create).toHaveBeenCalledWith('v1', dto);
      expect(result).toEqual(preBooking);
    });
  });

  describe('findAll', () => {
    it("delegates to preBookingsService.findAllForUser with the authenticated user's id and role", async () => {
      const preBookings = [{ id: 'pb1' }];
      mockPreBookingsService.findAllForUser.mockResolvedValue(preBookings);

      const result = await controller.findAll(mockRequest);

      expect(mockPreBookingsService.findAllForUser).toHaveBeenCalledWith(
        'v1',
        Role.VENDOR,
      );
      expect(result).toEqual(preBookings);
    });
  });

  describe('findOne', () => {
    it("delegates to preBookingsService.findOne with the authenticated user's id, role, and id param", async () => {
      const preBooking = { id: 'pb1' };
      mockPreBookingsService.findOne.mockResolvedValue(preBooking);

      const result = await controller.findOne(mockRequest, 'pb1');

      expect(mockPreBookingsService.findOne).toHaveBeenCalledWith(
        'v1',
        Role.VENDOR,
        'pb1',
      );
      expect(result).toEqual(preBooking);
    });
  });

  describe('cancel', () => {
    it("delegates to preBookingsService.cancel with the authenticated user's id and id param", async () => {
      const preBooking = { id: 'pb1', status: 'CANCELLED' };
      mockPreBookingsService.cancel.mockResolvedValue(preBooking);

      const result = await controller.cancel(mockRequest, 'pb1');

      expect(mockPreBookingsService.cancel).toHaveBeenCalledWith('v1', 'pb1');
      expect(result).toEqual(preBooking);
    });
  });

  describe('createPaymentIntent', () => {
    it("delegates to preBookingsService.createPaymentIntent with the authenticated user's id and id param", async () => {
      const intent = { razorpayOrderId: 'order_abc', amount: 140 };
      mockPreBookingsService.createPaymentIntent.mockResolvedValue(intent);

      const result = await controller.createPaymentIntent(mockRequest, 'pb1');

      expect(mockPreBookingsService.createPaymentIntent).toHaveBeenCalledWith(
        'v1',
        'pb1',
      );
      expect(result).toEqual(intent);
    });
  });

  describe('verifyPayment', () => {
    it("delegates to preBookingsService.verifyPayment with the authenticated user's id, id param, and dto", async () => {
      const dto = {
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_xyz',
        razorpaySignature: 'sig',
      };
      const payment = { id: 'pay1', status: 'SUCCESS' };
      mockPreBookingsService.verifyPayment.mockResolvedValue(payment);

      const result = await controller.verifyPayment(mockRequest, 'pb1', dto);

      expect(mockPreBookingsService.verifyPayment).toHaveBeenCalledWith(
        'v1',
        'pb1',
        dto,
      );
      expect(result).toEqual(payment);
    });
  });
});
