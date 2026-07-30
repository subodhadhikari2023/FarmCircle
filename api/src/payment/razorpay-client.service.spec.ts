import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import { RazorpayClient } from './razorpay-client.service';

describe('RazorpayClient', () => {
  let client: RazorpayClient;
  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'RAZORPAY_KEY_ID') return 'test-key-id';
      if (key === 'RAZORPAY_KEY_SECRET') return 'test-key-secret';
      throw new Error(`unexpected config key ${key}`);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayClient,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    client = module.get<RazorpayClient>(RazorpayClient);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('createOrder', () => {
    it('posts to the Razorpay orders API with Basic auth and returns the created order', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: 'order_abc', amount: 2800, currency: 'INR' }),
      });

      const result = await client.createOrder(2800, 'pb1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.razorpay.com/v1/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from('test-key-id:test-key-secret').toString('base64')}`,
            'Content-Type': 'application/json',
          }) as unknown,
          body: JSON.stringify({
            amount: 2800,
            currency: 'INR',
            receipt: 'pb1',
          }),
        }),
      );
      expect(result).toEqual({
        id: 'order_abc',
        amount: 2800,
        currency: 'INR',
      });
    });

    it('throws BadGatewayException when Razorpay responds with a non-ok status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(client.createOrder(2800, 'pb1')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException when the request itself fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

      await expect(client.createOrder(2800, 'pb1')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
