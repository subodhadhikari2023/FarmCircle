import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  Role,
} from 'generated/prisma/enums';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    create: jest.fn(),
    findAllForUser: jest.fn(),
    findOne: jest.fn(),
    advanceStatus: jest.fn(),
    cancel: jest.fn(),
    dispute: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: Role.CUSTOMER },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to ordersService.create with the authenticated user's id, role, and dto", async () => {
      const dto = {
        listingId: 'l1',
        quantity: 5,
        deliveryMethod: DeliveryMethod.PICKUP,
        paymentMethod: PaymentMethod.COD,
      };
      const order = { id: 'o1', buyerId: 'u1' };
      mockOrdersService.create.mockResolvedValue(order);

      const result = await controller.create(mockRequest, dto);

      expect(mockOrdersService.create).toHaveBeenCalledWith(
        'u1',
        Role.CUSTOMER,
        dto,
      );
      expect(result).toEqual(order);
    });
  });

  describe('findAll', () => {
    it("delegates to ordersService.findAllForUser with the authenticated user's id and role", async () => {
      const orders = [{ id: 'o1' }];
      mockOrdersService.findAllForUser.mockResolvedValue(orders);

      const result = await controller.findAll(mockRequest);

      expect(mockOrdersService.findAllForUser).toHaveBeenCalledWith(
        'u1',
        Role.CUSTOMER,
      );
      expect(result).toEqual(orders);
    });
  });

  describe('findOne', () => {
    it("delegates to ordersService.findOne with the authenticated user's id, role, and the id param", async () => {
      const order = { id: 'o1' };
      mockOrdersService.findOne.mockResolvedValue(order);

      const result = await controller.findOne(mockRequest, 'o1');

      expect(mockOrdersService.findOne).toHaveBeenCalledWith(
        'u1',
        Role.CUSTOMER,
        'o1',
      );
      expect(result).toEqual(order);
    });
  });

  describe('advanceStatus', () => {
    it("delegates to ordersService.advanceStatus with the authenticated user's id and the id param", async () => {
      const growerRequest = {
        user: { id: 'grower1', role: Role.GROWER },
      } as unknown as Request;
      const order = { id: 'o1', status: OrderStatus.CONFIRMED };
      mockOrdersService.advanceStatus.mockResolvedValue(order);

      const result = await controller.advanceStatus(growerRequest, 'o1');

      expect(mockOrdersService.advanceStatus).toHaveBeenCalledWith(
        'grower1',
        'o1',
      );
      expect(result).toEqual(order);
    });
  });

  describe('cancel', () => {
    it("delegates to ordersService.cancel with the authenticated user's id and the id param", async () => {
      const order = { id: 'o1', status: OrderStatus.CANCELLED };
      mockOrdersService.cancel.mockResolvedValue(order);

      const result = await controller.cancel(mockRequest, 'o1');

      expect(mockOrdersService.cancel).toHaveBeenCalledWith('u1', 'o1');
      expect(result).toEqual(order);
    });
  });

  describe('dispute', () => {
    it("delegates to ordersService.dispute with the authenticated admin's id, the id param, and dto", async () => {
      const adminRequest = {
        user: { id: 'admin1', role: Role.ADMIN },
      } as unknown as Request;
      const dto = { status: OrderStatus.CANCELLED };
      const order = { id: 'o1', status: OrderStatus.CANCELLED };
      mockOrdersService.dispute.mockResolvedValue(order);

      const result = await controller.dispute(adminRequest, 'o1', dto);

      expect(mockOrdersService.dispute).toHaveBeenCalledWith(
        'admin1',
        'o1',
        dto,
      );
      expect(result).toEqual(order);
    });
  });
});
