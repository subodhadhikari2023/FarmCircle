import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCycleDto) {
    const crop = await this.prisma.crop.findFirst({
      where: { id: dto.cropId, ownerId: userId },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }

    return this.prisma.cycle.create({
      data: { ownerId: userId, cropId: dto.cropId, name: dto.name },
    });
  }

  findAll(userId: string, cropId?: string) {
    return this.prisma.cycle.findMany({
      where: { ownerId: userId, ...(cropId ? { cropId } : {}) },
    });
  }

  async findOne(userId: string, id: string) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id, ownerId: userId },
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }
    return cycle;
  }

  async update(userId: string, id: string, dto: UpdateCycleDto) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id, ownerId: userId },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    return this.prisma.cycle.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  async remove(userId: string, id: string) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id, ownerId: userId },
      include: { _count: { select: { batches: true } } },
    });
    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }
    if (cycle._count.batches > 0) {
      throw new ConflictException('Cycle is in use by existing batches');
    }

    await this.prisma.$transaction([
      this.prisma.milestone.deleteMany({ where: { cycleId: id } }),
      this.prisma.cycle.delete({ where: { id } }),
    ]);
  }
}
