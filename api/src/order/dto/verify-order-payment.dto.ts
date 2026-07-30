import { IsNotEmpty, IsString } from 'class-validator';
import { VerifyPaymentDto } from '../../payment/dto/verify-payment.dto';

export class VerifyOrderPaymentDto extends VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  orderIntentId: string;
}
