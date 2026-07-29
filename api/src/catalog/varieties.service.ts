import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVarietyDto } from './dto/create-variety.dto';
import { UpdateVarietyDto } from './dto/update-variety.dto';

@Injectable()
export class VarietiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireOwnedCrop(userId: string, cropId: string) {
    const crop = await this.prisma.crop.findFirst({
      where: { id: cropId, ownerId: userId },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }
    return crop;
  }

  async create(userId: string, cropId: string, dto: CreateVarietyDto) {
    await this.requireOwnedCrop(userId, cropId);

    const existing = await this.prisma.variety.findFirst({
      where: { cropId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'Variety with this name already exists for this crop',
      );
    }

    return this.prisma.variety.create({
      data: { cropId, name: dto.name },
    });
  }

  async findAllByCrop(userId: string, cropId: string) {
    await this.requireOwnedCrop(userId, cropId);
    return this.prisma.variety.findMany({ where: { cropId } });
  }

  async update(userId: string, id: string, dto: UpdateVarietyDto) {
    const variety = await this.prisma.variety.findFirst({
      where: { id, crop: { ownerId: userId } },
    });
    if (!variety) {
      throw new NotFoundException('Variety not found');
    }

    if (dto.name) {
      const duplicate = await this.prisma.variety.findFirst({
        where: { cropId: variety.cropId, name: dto.name, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(
          'Variety with this name already exists for this crop',
        );
      }
    }

    return this.prisma.variety.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  async remove(userId: string, id: string) {
    const variety = await this.prisma.variety.findFirst({
      where: { id, crop: { ownerId: userId } },
      include: {
        _count: { select: { batches: true, listings: true } },
      },
    });
    if (!variety) {
      throw new NotFoundException('Variety not found');
    }

    const { batches, listings } = variety._count;
    if (batches > 0 || listings > 0) {
      throw new ConflictException(
        'Variety is in use by existing batches or listings',
      );
    }

    await this.prisma.variety.delete({ where: { id } });
  }
}
