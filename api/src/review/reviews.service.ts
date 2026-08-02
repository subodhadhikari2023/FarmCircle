import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { OrderStatus } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

const REVIEWABLE_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.PICKED_UP,
];

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, buyerId: userId },
      include: { listing: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!REVIEWABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('Order has not been fulfilled yet');
    }

    const existing = await this.prisma.review.findUnique({
      where: { orderId: dto.orderId },
    });
    if (existing) {
      throw new ConflictException('Order has already been reviewed');
    }

    // The findUnique check above is a fast path, not the real guard — the
    // @unique constraint on Review.orderId is what actually prevents two
    // concurrent submissions for the same order from both succeeding. A
    // race that slips past the check above hits that constraint here and
    // must be translated from a raw P2002 into the same 409 the check
    // above would have given.
    try {
      return await this.prisma.review.create({
        data: {
          reviewerId: userId,
          growerId: order.listing.ownerId,
          orderId: order.id,
          rating: dto.rating,
          comment: dto.comment,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Order has already been reviewed');
      }
      throw err;
    }
  }

  findAll() {
    return this.prisma.review.findMany({
      where: { isHidden: false },
      include: { reviewer: { select: { name: true } } },
    });
  }

  async findOne(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review || review.isHidden) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async hide(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.isHidden) {
      throw new ConflictException('Review is already hidden');
    }
    return this.prisma.review.update({
      where: { id },
      data: { isHidden: true },
    });
  }

  findHidden() {
    return this.prisma.review.findMany({
      where: { isHidden: true },
      include: { reviewer: { select: { name: true } } },
    });
  }

  async unhide(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (!review.isHidden) {
      throw new ConflictException('Review is not hidden');
    }
    return this.prisma.review.update({
      where: { id },
      data: { isHidden: false },
    });
  }
}
