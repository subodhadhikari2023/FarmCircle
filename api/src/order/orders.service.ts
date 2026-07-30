import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DisputeOrderDto } from './dto/dispute-order.dto';
import { DeliveryMethod, OrderStatus, Role } from 'generated/prisma/enums';

const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
];

const NEXT_STATUS: Partial<
  Record<OrderStatus, (deliveryMethod: DeliveryMethod) => OrderStatus>
> = {
  [OrderStatus.PLACED]: () => OrderStatus.CONFIRMED,
  [OrderStatus.CONFIRMED]: (deliveryMethod) =>
    deliveryMethod === DeliveryMethod.DELIVERY
      ? OrderStatus.OUT_FOR_DELIVERY
      : OrderStatus.READY_FOR_PICKUP,
  [OrderStatus.OUT_FOR_DELIVERY]: () => OrderStatus.DELIVERED,
  [OrderStatus.READY_FOR_PICKUP]: () => OrderStatus.PICKED_UP,
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, role: Role, dto: CreateOrderDto) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: dto.listingId, isPublished: true },
    });
    if (!listing || listing.isClosed) {
      throw new NotFoundException('Listing not found');
    }

    const availableQuantity = listing.availableQuantity.toNumber();
    if (dto.quantity > availableQuantity) {
      throw new ConflictException('Insufficient stock for this quantity');
    }

    const minWholesaleQty = listing.minWholesaleQty.toNumber();
    const retailPrice = listing.retailPrice.toNumber();
    const wholesalePrice = listing.wholesalePrice.toNumber();

    let unitPrice: number;
    if (role === Role.VENDOR) {
      unitPrice =
        dto.quantity >= minWholesaleQty ? wholesalePrice : retailPrice;
    } else {
      const retailCeilingPercent = listing.retailCeilingPercent.toNumber();
      const ceiling = minWholesaleQty * (1 + retailCeilingPercent / 100);
      if (dto.quantity > ceiling) {
        throw new ConflictException(
          'Quantity exceeds the retail ceiling for this listing',
        );
      }
      unitPrice = retailPrice;
    }

    let addressId: string | null = null;
    if (dto.deliveryMethod === DeliveryMethod.DELIVERY) {
      const address = await this.prisma.address.findFirst({
        where: { id: dto.addressId, userId },
      });
      if (!address) {
        throw new NotFoundException('Address not found');
      }
      addressId = address.id;
    }

    const totalAmount = unitPrice * dto.quantity;

    const [order] = await this.prisma.$transaction([
      this.prisma.order.create({
        data: {
          buyerId: userId,
          listingId: listing.id,
          quantity: dto.quantity,
          unitPrice,
          totalAmount,
          deliveryMethod: dto.deliveryMethod,
          addressId,
          paymentMethod: dto.paymentMethod,
        },
      }),
      this.prisma.listing.update({
        where: { id: listing.id },
        data: { availableQuantity: availableQuantity - dto.quantity },
      }),
    ]);

    return order;
  }

  findAllForUser(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      return this.prisma.order.findMany();
    }
    return this.prisma.order.findMany({ where: { buyerId: userId } });
  }

  async findOne(userId: string, role: Role, id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (role !== Role.ADMIN && order.buyerId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

  async advanceStatus(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!order || order.listing.ownerId !== userId) {
      throw new NotFoundException('Order not found');
    }

    const nextStatusFor = NEXT_STATUS[order.status];
    if (!nextStatusFor) {
      throw new ConflictException('Order has no further status to advance to');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: nextStatusFor(order.deliveryMethod) },
    });
  }

  async cancel(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, buyerId: userId },
      include: { listing: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('Order can no longer be cancelled');
    }

    const [updatedOrder] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      }),
      this.prisma.listing.update({
        where: { id: order.listingId },
        data: {
          availableQuantity:
            order.listing.availableQuantity.toNumber() +
            order.quantity.toNumber(),
        },
      }),
    ]);

    return updatedOrder;
  }

  async dispute(id: string, dto: DisputeOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const releasesStock =
      dto.status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED;

    if (!releasesStock) {
      return this.prisma.order.update({
        where: { id },
        data: { status: dto.status },
      });
    }

    const [updatedOrder] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: dto.status },
      }),
      this.prisma.listing.update({
        where: { id: order.listingId },
        data: {
          availableQuantity:
            order.listing.availableQuantity.toNumber() +
            order.quantity.toNumber(),
        },
      }),
    ]);

    return updatedOrder;
  }
}
