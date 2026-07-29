import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, cycleId: string, dto: CreateMilestoneDto) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, ownerId: userId },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    const existing = await this.prisma.milestone.findFirst({
      where: { cycleId, order: dto.order },
    });
    if (existing) {
      throw new ConflictException(
        'A milestone with this order already exists for this cycle',
      );
    }

    return this.prisma.milestone.create({
      data: {
        cycleId,
        name: dto.name,
        order: dto.order,
        expectedDurationDays: dto.expectedDurationDays,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id, cycle: { ownerId: userId } },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (dto.order !== undefined) {
      const duplicate = await this.prisma.milestone.findFirst({
        where: {
          cycleId: milestone.cycleId,
          order: dto.order,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          'A milestone with this order already exists for this cycle',
        );
      }
    }

    return this.prisma.milestone.update({
      where: { id },
      data: {
        name: dto.name,
        order: dto.order,
        expectedDurationDays: dto.expectedDurationDays,
      },
    });
  }

  async remove(userId: string, id: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id, cycle: { ownerId: userId } },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const reachedByBatch = await this.prisma.batchMilestoneProgress.findFirst({
      where: { milestoneId: id, reachedAt: { not: null } },
    });
    if (reachedByBatch) {
      throw new ConflictException(
        'A batch has already progressed past this milestone',
      );
    }

    await this.prisma.milestone.delete({ where: { id } });
  }
}
