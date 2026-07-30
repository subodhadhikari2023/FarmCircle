import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Role } from 'generated/prisma/enums';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  const mockReviewsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    hide: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: Role.CUSTOMER },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to reviewsService.create with the authenticated user's id and dto", async () => {
      const dto = { orderId: 'o1', rating: 5, comment: 'Great!' };
      const review = { id: 'r1' };
      mockReviewsService.create.mockResolvedValue(review);

      const result = await controller.create(mockRequest, dto);

      expect(mockReviewsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(review);
    });
  });

  describe('findAll', () => {
    it('delegates to reviewsService.findAll', async () => {
      const reviews = [{ id: 'r1' }];
      mockReviewsService.findAll.mockResolvedValue(reviews);

      const result = await controller.findAll();

      expect(mockReviewsService.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(reviews);
    });
  });

  describe('findOne', () => {
    it('delegates to reviewsService.findOne with the id param', async () => {
      const review = { id: 'r1' };
      mockReviewsService.findOne.mockResolvedValue(review);

      const result = await controller.findOne('r1');

      expect(mockReviewsService.findOne).toHaveBeenCalledWith('r1');
      expect(result).toEqual(review);
    });
  });

  describe('hide', () => {
    it('delegates to reviewsService.hide with the id param', async () => {
      const review = { id: 'r1', isHidden: true };
      mockReviewsService.hide.mockResolvedValue(review);

      const result = await controller.hide('r1');

      expect(mockReviewsService.hide).toHaveBeenCalledWith('r1');
      expect(result).toEqual(review);
    });
  });
});
