import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-razorpay-signature'];
    if (!req.rawBody || typeof signature !== 'string') {
      throw new BadRequestException('Missing webhook signature');
    }
    return this.paymentsService.handleWebhook(
      req.rawBody.toString('utf8'),
      signature,
    );
  }
}
