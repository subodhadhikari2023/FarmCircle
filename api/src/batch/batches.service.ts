import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { AdvanceMilestoneDto } from './dto/advance-milestone.dto';
import { ConfirmHarvestDto } from './dto/confirm-harvest.dto';

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

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
    return batch;
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

    return this.prisma.batch.update({
      where: { id },
      data: { actualYield: dto.actualYield, harvestConfirmed: true },
    });
  }

  async getTimeline(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
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
    return batch;
  }
}
