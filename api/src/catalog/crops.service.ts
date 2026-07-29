import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';

@Injectable()
export class CropsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCropDto) {
    const existing = await this.prisma.crop.findFirst({
      where: { ownerId: userId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Crop with this name already exists');
    }
    return this.prisma.crop.create({
      data: { ownerId: userId, name: dto.name },
    });
  }

  findAll(userId: string) {
    return this.prisma.crop.findMany({ where: { ownerId: userId } });
  }

  async findOne(userId: string, id: string) {
    const crop = await this.prisma.crop.findFirst({
      where: { id, ownerId: userId },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }
    return crop;
  }

  async update(userId: string, id: string, dto: UpdateCropDto) {
    const crop = await this.prisma.crop.findFirst({
      where: { id, ownerId: userId },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }

    if (dto.name) {
      const duplicate = await this.prisma.crop.findFirst({
        where: { ownerId: userId, name: dto.name, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException('Crop with this name already exists');
      }
    }

    return this.prisma.crop.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  async remove(userId: string, id: string) {
    const crop = await this.prisma.crop.findFirst({
      where: { id, ownerId: userId },
      include: {
        _count: {
          select: {
            varieties: true,
            cycles: true,
            batches: true,
            listings: true,
          },
        },
      },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }

    const { varieties, cycles, batches, listings } = crop._count;
    if (varieties > 0 || cycles > 0 || batches > 0 || listings > 0) {
      throw new ConflictException(
        'Crop is in use by existing varieties, cycles, batches, or listings',
      );
    }

    await this.prisma.crop.delete({ where: { id } });
  }
}
