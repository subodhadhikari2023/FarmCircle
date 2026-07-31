import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from 'generated/prisma/enums';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockPrismaService = {
    order: {
      findFirst: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = { orderId: 'o1', rating: 5, comment: 'Great produce!' };

    it('creates a review for a delivered order owned by the reviewer', async () => {
      const order = {
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.DELIVERED,
        listing: { ownerId: 'grower1' },
      };
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.review.findUnique.mockResolvedValue(null);
      const created = {
        id: 'r1',
        reviewerId: 'u1',
        growerId: 'grower1',
        orderId: 'o1',
        rating: 5,
        comment: 'Great produce!',
      };
      mockPrismaService.review.create.mockResolvedValue(created);

      const result = await service.create('u1', dto);

      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'o1', buyerId: 'u1' },
        include: { listing: true },
      });
      expect(mockPrismaService.review.findUnique).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
      });
      expect(mockPrismaService.review.create).toHaveBeenCalledWith({
        data: {
          reviewerId: 'u1',
          growerId: 'grower1',
          orderId: 'o1',
          rating: 5,
          comment: 'Great produce!',
        },
      });
      expect(result).toEqual(created);
    });

    it('creates a review for a picked-up order', async () => {
      const order = {
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.PICKED_UP,
        listing: { ownerId: 'grower1' },
      };
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.review.findUnique.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue({ id: 'r1' });

      await service.create('u1', dto);

      expect(mockPrismaService.review.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when the order does not exist or is not owned by the reviewer', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.review.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the order has not been fulfilled yet', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.OUT_FOR_DELIVERY,
        listing: { ownerId: 'grower1' },
      });

      await expect(service.create('u1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.review.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the order has already been reviewed', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.DELIVERED,
        listing: { ownerId: 'grower1' },
      });
      mockPrismaService.review.findUnique.mockResolvedValue({ id: 'r1' });

      await expect(service.create('u1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.review.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns only non-hidden reviews', async () => {
      const reviews = [
        { id: 'r1', isHidden: false, reviewer: { name: 'Ada' } },
      ];
      mockPrismaService.review.findMany.mockResolvedValue(reviews);

      const result = await service.findAll();

      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { isHidden: false },
        include: { reviewer: { select: { name: true } } },
      });
      expect(result).toEqual(reviews);
    });
  });

  describe('findOne', () => {
    it('returns a non-hidden review', async () => {
      const review = { id: 'r1', isHidden: false };
      mockPrismaService.review.findUnique.mockResolvedValue(review);

      const result = await service.findOne('r1');

      expect(result).toEqual(review);
    });

    it('throws NotFoundException when the review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(service.findOne('r1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the review has been hidden', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        id: 'r1',
        isHidden: true,
      });

      await expect(service.findOne('r1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('hide', () => {
    it('marks a review as hidden', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        id: 'r1',
        isHidden: false,
      });
      const updated = { id: 'r1', isHidden: true };
      mockPrismaService.review.update.mockResolvedValue(updated);

      const result = await service.hide('r1');

      expect(mockPrismaService.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isHidden: true },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(service.hide('r1')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.review.update).not.toHaveBeenCalled();
    });
  });
});
