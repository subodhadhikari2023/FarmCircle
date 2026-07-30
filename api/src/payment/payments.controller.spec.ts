import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  const mockPaymentsService = {
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('delegates to paymentsService.handleWebhook with the raw body and signature header', async () => {
      const req = {
        rawBody: Buffer.from('{"event":"payment.captured"}'),
        headers: { 'x-razorpay-signature': 'sig123' },
      } as unknown as RawBodyRequest<Request>;
      mockPaymentsService.handleWebhook.mockResolvedValue({ received: true });

      const result = await controller.handleWebhook(req);

      expect(mockPaymentsService.handleWebhook).toHaveBeenCalledWith(
        '{"event":"payment.captured"}',
        'sig123',
      );
      expect(result).toEqual({ received: true });
    });

    it('throws BadRequestException when the signature header is missing', () => {
      const req = {
        rawBody: Buffer.from('{}'),
        headers: {},
      } as unknown as RawBodyRequest<Request>;

      expect(() => controller.handleWebhook(req)).toThrow(BadRequestException);
    });

    it('throws BadRequestException when the raw body is missing', () => {
      const req = {
        rawBody: undefined,
        headers: { 'x-razorpay-signature': 'sig123' },
      } as unknown as RawBodyRequest<Request>;

      expect(() => controller.handleWebhook(req)).toThrow(BadRequestException);
    });
  });
});
