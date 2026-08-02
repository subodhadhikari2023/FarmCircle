import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payment/payments.service';
import { OrderStatusHistory } from './schemas/order-status-history.schema';
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  Role,
} from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

const recordNotFoundError = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });

const decimal = (n: number) => ({ toNumber: () => n });

describe('OrdersService', () => {
  let service: OrdersService;

  const mockPrismaService = {
    listing: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findFirst: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderIntent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockHistoryModel = {
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockPaymentsService = {
    createOrderIntentPayment: jest.fn(),
    verifyOrderIntentPayment: jest.fn(),
  };

  function stubHistory(entries: unknown[] = []) {
    const sort = jest.fn().mockResolvedValue(entries);
    mockHistoryModel.find.mockReturnValue({ sort });
    return sort;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    stubHistory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: getModelToken(OrderStatusHistory.name),
          useValue: mockHistoryModel,
        },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseListing = {
      id: 'l1',
      ownerId: 'grower1',
      isPublished: true,
      isClosed: false,
      retailPrice: decimal(50),
      wholesalePrice: decimal(35),
      minWholesaleQty: decimal(15),
      retailCeilingPercent: decimal(10),
      availableQuantity: decimal(100),
    };

    const pickupDto = {
      listingId: 'l1',
      quantity: 5,
      deliveryMethod: DeliveryMethod.PICKUP,
      paymentMethod: PaymentMethod.COD,
    };

    function stubTransaction(orderResult: unknown, listingResult?: unknown) {
      mockPrismaService.order.create.mockReturnValue('order-create-op');
      mockPrismaService.listing.update.mockReturnValue('listing-update-op');
      // Real code destructures [, order] — the guarded listing update runs
      // first, the order create second.
      mockPrismaService.$transaction.mockResolvedValue([
        listingResult,
        orderResult,
      ]);
    }

    it('throws NotFoundException when the listing does not exist or is unpublished', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(
        service.create('u1', Role.CUSTOMER, pickupDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the listing is closed', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue({
        ...baseListing,
        isClosed: true,
      });

      await expect(
        service.create('u1', Role.CUSTOMER, pickupDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when quantity exceeds available stock', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);

      await expect(
        service.create('u1', Role.CUSTOMER, { ...pickupDto, quantity: 200 }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('prices a Vendor order at wholesale once quantity meets minWholesaleQty and logs the initial PLACED status', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      const created = {
        id: 'o1',
        status: OrderStatus.PLACED,
        unitPrice: 35,
        totalAmount: 525,
      };
      stubTransaction(created, {
        ...baseListing,
        availableQuantity: decimal(85),
      });

      const result = await service.create('vendor1', Role.VENDOR, {
        ...pickupDto,
        quantity: 15,
      });

      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'vendor1',
          listingId: 'l1',
          quantity: 15,
          unitPrice: 35,
          totalAmount: 525,
          deliveryMethod: DeliveryMethod.PICKUP,
          addressId: null,
          paymentMethod: PaymentMethod.COD,
        },
      });
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1', availableQuantity: { gte: 15 } },
        data: { availableQuantity: { decrement: 15 } },
      });
      expect(mockHistoryModel.create).toHaveBeenCalledWith({
        orderId: 'o1',
        status: OrderStatus.PLACED,
        changedBy: 'vendor1',
      });
      expect(result).toEqual(created);
    });

    it('throws ConflictException, without creating an order, when the guarded stock decrement loses a concurrency race', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      mockPrismaService.$transaction.mockRejectedValue(recordNotFoundError());

      await expect(
        service.create('customer1', Role.CUSTOMER, {
          ...pickupDto,
          quantity: 5,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockHistoryModel.create).not.toHaveBeenCalled();
    });

    it('falls back a Vendor order to retail pricing below minWholesaleQty', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      const created = {
        id: 'o1',
        status: OrderStatus.PLACED,
        unitPrice: 50,
        totalAmount: 250,
      };
      stubTransaction(created);

      await service.create('vendor1', Role.VENDOR, {
        ...pickupDto,
        quantity: 5,
      });

      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'vendor1',
          listingId: 'l1',
          quantity: 5,
          unitPrice: 50,
          totalAmount: 250,
          deliveryMethod: DeliveryMethod.PICKUP,
          addressId: null,
          paymentMethod: PaymentMethod.COD,
        },
      });
    });

    it('always prices a Customer order at retail', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      const created = {
        id: 'o1',
        status: OrderStatus.PLACED,
        unitPrice: 50,
        totalAmount: 800,
      };
      stubTransaction(created);

      await service.create('customer1', Role.CUSTOMER, {
        ...pickupDto,
        quantity: 16,
      });

      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'customer1',
          listingId: 'l1',
          quantity: 16,
          unitPrice: 50,
          totalAmount: 800,
          deliveryMethod: DeliveryMethod.PICKUP,
          addressId: null,
          paymentMethod: PaymentMethod.COD,
        },
      });
    });

    it('throws ConflictException when a Customer order exceeds the retail ceiling', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);

      // minWholesaleQty 15, retailCeilingPercent 10 => ceiling is 16.5
      await expect(
        service.create('customer1', Role.CUSTOMER, {
          ...pickupDto,
          quantity: 17,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('allows a Vendor order above the retail ceiling threshold (ceiling only applies to Customers)', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      const created = { id: 'o1', status: OrderStatus.PLACED };
      stubTransaction(created);

      await expect(
        service.create('vendor1', Role.VENDOR, { ...pickupDto, quantity: 50 }),
      ).resolves.toEqual(created);
    });

    it('requires and validates addressId ownership for delivery orders', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      mockPrismaService.address.findFirst.mockResolvedValue(null);

      await expect(
        service.create('customer1', Role.CUSTOMER, {
          ...pickupDto,
          deliveryMethod: DeliveryMethod.DELIVERY,
          addressId: 'addr1',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('stores the validated addressId for a delivery order', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      mockPrismaService.address.findFirst.mockResolvedValue({
        id: 'addr1',
        userId: 'customer1',
      });
      const created = { id: 'o1', status: OrderStatus.PLACED };
      stubTransaction(created);

      await service.create('customer1', Role.CUSTOMER, {
        ...pickupDto,
        deliveryMethod: DeliveryMethod.DELIVERY,
        addressId: 'addr1',
      });

      expect(mockPrismaService.address.findFirst).toHaveBeenCalledWith({
        where: { id: 'addr1', userId: 'customer1' },
      });
      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'customer1',
          listingId: 'l1',
          quantity: 5,
          unitPrice: 50,
          totalAmount: 250,
          deliveryMethod: DeliveryMethod.DELIVERY,
          addressId: 'addr1',
          paymentMethod: PaymentMethod.COD,
        },
      });
    });

    it('creates an OrderIntent and returns a payment intent for ONLINE payment, without creating an Order or decrementing stock', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(baseListing);
      mockPrismaService.orderIntent.create.mockResolvedValue({
        id: 'oi1',
        buyerId: 'customer1',
        listingId: 'l1',
        quantity: 5,
        unitPrice: 50,
        totalAmount: 250,
        deliveryMethod: DeliveryMethod.PICKUP,
        addressId: null,
        paymentMethod: PaymentMethod.ONLINE,
      });
      const intentPayment = {
        orderIntentId: 'oi1',
        razorpayOrderId: 'order_abc',
        amount: 250,
        currency: 'INR',
        keyId: 'test-key-id',
      };
      mockPaymentsService.createOrderIntentPayment.mockResolvedValue(
        intentPayment,
      );

      const result = await service.create('customer1', Role.CUSTOMER, {
        ...pickupDto,
        paymentMethod: PaymentMethod.ONLINE,
      });

      expect(mockPrismaService.orderIntent.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'customer1',
          listingId: 'l1',
          quantity: 5,
          unitPrice: 50,
          totalAmount: 250,
          deliveryMethod: DeliveryMethod.PICKUP,
          addressId: null,
          paymentMethod: PaymentMethod.ONLINE,
        },
      });
      expect(mockPaymentsService.createOrderIntentPayment).toHaveBeenCalledWith(
        'oi1',
        250,
      );
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual(intentPayment);
    });
  });

  describe('findAllForUser', () => {
    it('returns all orders for an Admin', async () => {
      const orders = [{ id: 'o1' }, { id: 'o2' }];
      mockPrismaService.order.findMany.mockResolvedValue(orders);

      const result = await service.findAllForUser('admin1', Role.ADMIN);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith();
      expect(result).toEqual(orders);
    });

    it("returns only the requesting buyer's orders for a Vendor/Customer", async () => {
      const orders = [{ id: 'o1', buyerId: 'u1' }];
      mockPrismaService.order.findMany.mockResolvedValue(orders);

      const result = await service.findAllForUser('u1', Role.CUSTOMER);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'u1' },
      });
      expect(result).toEqual(orders);
    });

    it("returns only orders on the requesting Grower's own listings", async () => {
      const orders = [{ id: 'o1', listingId: 'l1' }];
      mockPrismaService.order.findMany.mockResolvedValue(orders);

      const result = await service.findAllForUser('grower1', Role.GROWER);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { listing: { ownerId: 'grower1' } },
      });
      expect(result).toEqual(orders);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne('u1', Role.CUSTOMER, 'o1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when a non-owner, non-Admin requests the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        buyerId: 'someoneElse',
      });

      await expect(service.findOne('u1', Role.CUSTOMER, 'o1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the order merged with its chronological status history for its own buyer', async () => {
      const order = { id: 'o1', buyerId: 'u1' };
      mockPrismaService.order.findUnique.mockResolvedValue(order);
      const history = [{ orderId: 'o1', status: OrderStatus.PLACED }];
      const sort = stubHistory(history);

      const result = await service.findOne('u1', Role.CUSTOMER, 'o1');

      expect(mockHistoryModel.find).toHaveBeenCalledWith({ orderId: 'o1' });
      expect(sort).toHaveBeenCalledWith({ changedAt: 1 });
      expect(result).toEqual({ ...order, statusHistory: history });
    });

    it('returns any order for an Admin regardless of buyer', async () => {
      const order = { id: 'o1', buyerId: 'someoneElse' };
      mockPrismaService.order.findUnique.mockResolvedValue(order);
      stubHistory([]);

      const result = await service.findOne('admin1', Role.ADMIN, 'o1');

      expect(result).toEqual({ ...order, statusHistory: [] });
    });

    it("throws ForbiddenException when a Grower does not own the order's listing", async () => {
      const order = { id: 'o1', buyerId: 'someoneElse', listingId: 'l1' };
      mockPrismaService.order.findUnique.mockResolvedValue(order);
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('grower1', Role.GROWER, 'o1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { id: 'l1', ownerId: 'grower1' },
      });
    });

    it("returns the order for a Grower who owns the order's listing", async () => {
      const order = { id: 'o1', buyerId: 'someoneElse', listingId: 'l1' };
      mockPrismaService.order.findUnique.mockResolvedValue(order);
      mockPrismaService.listing.findFirst.mockResolvedValue({
        id: 'l1',
        ownerId: 'grower1',
      });
      const history = [{ orderId: 'o1', status: OrderStatus.PLACED }];
      stubHistory(history);

      const result = await service.findOne('grower1', Role.GROWER, 'o1');

      expect(result).toEqual({ ...order, statusHistory: history });
    });
  });

  describe('advanceStatus', () => {
    it('throws NotFoundException when the order does not exist or its listing is not owned by the requesting Grower', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.advanceStatus('grower1', 'o1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('advances PLACED to CONFIRMED and logs the change', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PLACED,
        deliveryMethod: DeliveryMethod.DELIVERY,
        listing: { ownerId: 'grower1' },
      });
      const updated = { id: 'o1', status: OrderStatus.CONFIRMED };
      mockPrismaService.order.update.mockResolvedValue(updated);

      const result = await service.advanceStatus('grower1', 'o1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: OrderStatus.CONFIRMED },
      });
      expect(mockHistoryModel.create).toHaveBeenCalledWith({
        orderId: 'o1',
        status: OrderStatus.CONFIRMED,
        changedBy: 'grower1',
      });
      expect(result).toEqual(updated);
    });

    it('advances CONFIRMED to OUT_FOR_DELIVERY for a delivery order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CONFIRMED,
        deliveryMethod: DeliveryMethod.DELIVERY,
        listing: { ownerId: 'grower1' },
      });
      mockPrismaService.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.OUT_FOR_DELIVERY,
      });

      await service.advanceStatus('grower1', 'o1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
      });
    });

    it('advances CONFIRMED to READY_FOR_PICKUP for a pickup order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CONFIRMED,
        deliveryMethod: DeliveryMethod.PICKUP,
        listing: { ownerId: 'grower1' },
      });
      mockPrismaService.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.READY_FOR_PICKUP,
      });

      await service.advanceStatus('grower1', 'o1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: OrderStatus.READY_FOR_PICKUP },
      });
    });

    it('throws ConflictException when the order is already at a terminal status', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.DELIVERED,
        deliveryMethod: DeliveryMethod.DELIVERY,
        listing: { ownerId: 'grower1' },
      });

      await expect(service.advanceStatus('grower1', 'o1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockHistoryModel.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when the order does not exist or is not owned by the requesting buyer', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.cancel('u1', 'o1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException once the order is past a cancellable status', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.OUT_FOR_DELIVERY,
      });

      await expect(service.cancel('u1', 'o1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('cancels a PLACED order, releases its quantity back to the listing, and logs the change', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.PLACED,
        listingId: 'l1',
        quantity: decimal(10),
        listing: { id: 'l1', availableQuantity: decimal(90) },
      });
      mockPrismaService.order.update.mockReturnValue('order-update-op');
      mockPrismaService.listing.update.mockReturnValue('listing-update-op');
      const updatedOrder = { id: 'o1', status: OrderStatus.CANCELLED };
      mockPrismaService.$transaction.mockResolvedValue([updatedOrder, {}]);

      const result = await service.cancel('u1', 'o1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: {
          id: 'o1',
          status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED] },
        },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { availableQuantity: { increment: 10 } },
      });
      expect(mockHistoryModel.create).toHaveBeenCalledWith({
        orderId: 'o1',
        status: OrderStatus.CANCELLED,
        changedBy: 'u1',
      });
      expect(result).toEqual(updatedOrder);
    });

    it('throws ConflictException, without logging a status change, when the order was already cancelled/advanced by a concurrent request', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'o1',
        buyerId: 'u1',
        status: OrderStatus.PLACED,
        listingId: 'l1',
        quantity: decimal(10),
        listing: { id: 'l1', availableQuantity: decimal(90) },
      });
      mockPrismaService.$transaction.mockRejectedValue(recordNotFoundError());

      await expect(service.cancel('u1', 'o1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockHistoryModel.create).not.toHaveBeenCalled();
    });
  });

  describe('dispute', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.dispute('admin1', 'o1', { status: OrderStatus.CANCELLED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('releases stock back to the listing when forcing an order to CANCELLED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CONFIRMED,
        listingId: 'l1',
        quantity: decimal(5),
        listing: { id: 'l1', availableQuantity: decimal(95) },
      });
      mockPrismaService.order.update.mockReturnValue('order-update-op');
      mockPrismaService.listing.update.mockReturnValue('listing-update-op');
      const updatedOrder = { id: 'o1', status: OrderStatus.CANCELLED };
      mockPrismaService.$transaction.mockResolvedValue([updatedOrder, {}]);

      const result = await service.dispute('admin1', 'o1', {
        status: OrderStatus.CANCELLED,
      });

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'o1', status: { not: OrderStatus.CANCELLED } },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { availableQuantity: { increment: 5 } },
      });
      expect(result).toEqual(updatedOrder);
    });

    it('throws ConflictException, without logging a status change, when the order was already cancelled by a concurrent request', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CONFIRMED,
        listingId: 'l1',
        quantity: decimal(5),
        listing: { id: 'l1', availableQuantity: decimal(95) },
      });
      mockPrismaService.$transaction.mockRejectedValue(recordNotFoundError());

      await expect(
        service.dispute('admin1', 'o1', { status: OrderStatus.CANCELLED }),
      ).rejects.toThrow(ConflictException);
      expect(mockHistoryModel.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException, without touching stock, when the order is already CANCELLED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CANCELLED,
        listingId: 'l1',
        quantity: decimal(5),
        listing: { id: 'l1', availableQuantity: decimal(100) },
      });

      await expect(
        service.dispute('admin1', 'o1', { status: OrderStatus.CANCELLED }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockPrismaService.listing.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('delegates to paymentsService.verifyOrderIntentPayment', async () => {
      const dto = {
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_xyz',
        razorpaySignature: 'sig',
      };
      const payment = { id: 'pay1', status: 'SUCCESS' };
      mockPaymentsService.verifyOrderIntentPayment.mockResolvedValue(payment);

      const result = await service.verifyPayment('u1', 'oi1', dto);

      expect(mockPaymentsService.verifyOrderIntentPayment).toHaveBeenCalledWith(
        'u1',
        'oi1',
        dto,
      );
      expect(result).toEqual(payment);
    });
  });
});
