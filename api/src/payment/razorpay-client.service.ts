import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';

@Injectable()
export class RazorpayClient {
  constructor(private readonly configService: ConfigService) {}

  async createOrder(
    amountInPaise: number,
    receipt: string,
  ): Promise<RazorpayOrder> {
    const keyId = this.configService.getOrThrow<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.getOrThrow<string>(
      'RAZORPAY_KEY_SECRET',
    );
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    let response: Response;
    try {
      response = await fetch(RAZORPAY_ORDERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt,
        }),
      });
    } catch {
      throw new BadGatewayException('Failed to reach Razorpay');
    }

    if (!response.ok) {
      throw new BadGatewayException('Razorpay order creation failed');
    }

    return (await response.json()) as RazorpayOrder;
  }
}
