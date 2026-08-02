import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { AdvanceMilestoneDto } from './dto/advance-milestone.dto';
import { ConfirmHarvestDto } from './dto/confirm-harvest.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import {
  BatchActivityLog,
  BatchActivityLogDocument,
} from './schemas/batch-activity-log.schema';
import { PreBookingStatus } from 'generated/prisma/enums';

const PAYMENT_HOLD_SECONDS = 48 * 60 * 60;

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectModel(BatchActivityLog.name)
    private readonly activityLogModel: Model<BatchActivityLogDocument>,
  ) {}

  async create(userId: string, dto: CreateBatchDto) {
    const crop = await this.prisma.crop.findFirst({
      where: { id: dto.cropId, ownerId: userId },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }

    const variety = await this.prisma.variety.findFirst({
      where: { id: dto.varietyId, cropId: dto.cropId },
    });
    if (!variety) {
      throw new NotFoundException('Variety not found for this crop');
    }

    const cycle = await this.prisma.cycle.findFirst({
      where: { id: dto.cycleId, ownerId: userId, cropId: dto.cropId },
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found for this crop');
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          ownerId: userId,
          cropId: dto.cropId,
          varietyId: dto.varietyId,
          cycleId: dto.cycleId,
          quantity: dto.quantity,
          predictedYield: dto.predictedYield,
        },
      });

      if (cycle.milestones.length > 0) {
        await tx.batchMilestoneProgress.createMany({
          data: cycle.milestones.map((milestone) => ({
            batchId: batch.id,
            milestoneId: milestone.id,
            order: milestone.order,
          })),
        });
      }

      return batch;
    });
  }

  findAll(userId: string) {
    return this.prisma.batch.findMany({ where: { ownerId: userId } });
  }

  async findOne(userId: string, id: string) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, ownerId: userId },
      include: {
        milestoneProgress: {
          orderBy: { order: 'asc' },
          include: { milestone: true },
        },
      },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const activityLog = await this.activityLogModel
      .find({ batchId: id })
      .sort({ loggedAt: 1 });

    return { ...batch, activityLog };
  }

  async addActivity(userId: string, id: string, dto: CreateActivityLogDto) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, ownerId: userId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return this.activityLogModel.create({
      batchId: id,
      note: dto.note,
      photos: dto.photos ?? [],
    });
  }

  async advanceMilestone(userId: string, id: string, dto: AdvanceMilestoneDto) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, ownerId: userId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const nextProgress = await this.prisma.batchMilestoneProgress.findFirst({
      where: { batchId: id, order: batch.currentMilestoneOrder + 1 },
    });
    if (!nextProgress) {
      throw new ConflictException('No further milestones to advance to');
    }

    const [, updatedBatch] = await this.prisma.$transaction([
      this.prisma.batchMilestoneProgress.update({
        where: { id: nextProgress.id },
        data: { reachedAt: new Date(dto.reachedAt) },
      }),
      this.prisma.batch.update({
        where: { id },
        data: { currentMilestoneOrder: nextProgress.order },
      }),
    ]);

    return updatedBatch;
  }

  async confirmHarvest(userId: string, id: string, dto: ConfirmHarvestDto) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, ownerId: userId },
      include: { milestoneProgress: true },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    if (batch.harvestConfirmed) {
      throw new ConflictException('Harvest already confirmed for this batch');
    }

    const finalOrder = batch.milestoneProgress.reduce(
      (max, progress) => Math.max(max, progress.order),
      0,
    );
    if (batch.currentMilestoneOrder < finalOrder) {
      throw new ConflictException(
        'Batch has not reached its final milestone yet',
      );
    }

    const { updatedBatch, queuedPreBookingIds } =
      await this.prisma.$transaction(async (tx) => {
        const listing = await tx.listing.findFirst({
          where: { batchId: id },
        });
        if (!listing) {
          throw new ConflictException(
            'Set listing terms before confirming harvest',
          );
        }

        const updatedBatch = await tx.batch.update({
          where: { id },
          data: { actualYield: dto.actualYield, harvestConfirmed: true },
        });

        await tx.listing.update({
          where: { id: listing.id },
          data: { availableQuantity: dto.actualYield, isPublished: true },
        });

        const queuedPreBookings = await tx.preBooking.findMany({
          where: { batchId: id, status: PreBookingStatus.QUEUED },
        });
        const holdExpiresAt = new Date(
          Date.now() + PAYMENT_HOLD_SECONDS * 1000,
        );
        for (const preBooking of queuedPreBookings) {
          await tx.preBooking.update({
            where: { id: preBooking.id },
            data: {
              status: PreBookingStatus.AWAITING_PAYMENT,
              listingId: listing.id,
              advanceAmount:
                preBooking.quantity.toNumber() *
                listing.wholesalePrice.toNumber() *
                0.2,
              holdExpiresAt,
            },
          });
        }

        return {
          updatedBatch,
          queuedPreBookingIds: queuedPreBookings.map((p) => p.id),
        };
      });

    await Promise.all(
      queuedPreBookingIds.map((preBookingId) =>
        this.redis.setPaymentHold(preBookingId, PAYMENT_HOLD_SECONDS),
      ),
    );

    return updatedBatch;
  }

  async getTimeline(id: string) {
    // Public and unauthenticated — only expose the milestone timeline once
    // there's a published, tracked-path Listing for this batch (matches the
    // requirements doc's "buyers of hasTrackedCycle listings" scope), and
    // only the milestone names/dates, never Grower-only batch fields like
    // predictedYield, quantity, or ownerId.
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: {
        listing: true,
        milestoneProgress: {
          orderBy: { order: 'asc' },
          include: { milestone: true },
        },
      },
    });
    if (
      !batch ||
      !batch.listing?.isPublished ||
      !batch.listing.hasTrackedCycle
    ) {
      throw new NotFoundException('Batch not found');
    }

    return {
      batchId: batch.id,
      milestones: batch.milestoneProgress.map((progress) => ({
        name: progress.milestone.name,
        order: progress.order,
        expectedDurationDays: progress.milestone.expectedDurationDays,
        reachedAt: progress.reachedAt,
      })),
    };
  }
}
