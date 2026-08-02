import { IsIn } from 'class-validator';
import { OrderStatus } from 'generated/prisma/enums';

// Previously accepted any OrderStatus with no transition validation, letting
// an Admin force nonsensical transitions (e.g. DELIVERED -> PLACED, or
// CANCELLED after PICKED_UP). Dispute resolution is now scoped to exactly
// the one path the service actually guards safely: force-cancel + release
// stock. Restricted to a fixed array (not just `OrderStatus.CANCELLED`
// directly) so a future, deliberately-added safe transition has an obvious
// place to go.
export class DisputeOrderDto {
  @IsIn([OrderStatus.CANCELLED])
  status: typeof OrderStatus.CANCELLED;
}
