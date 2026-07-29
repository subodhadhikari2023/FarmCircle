import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from 'generated/prisma/enums';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isSuspended: true,
  createdAt: true,
  updatedAt: true,
} as const;

const MANAGEABLE_ROLES: Role[] = [Role.VENDOR, Role.CUSTOMER];

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  findMe(userId: string) {
    return this.prismaService.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  }

  updateMe(userId: string, dto: UpdateUserDto) {
    return this.prismaService.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: SAFE_USER_SELECT,
    });
  }

  findAll() {
    return this.prismaService.user.findMany({
      where: { role: { in: MANAGEABLE_ROLES } },
      select: SAFE_USER_SELECT,
    });
  }

  async findOne(id: string) {
    const user = await this.prismaService.user.findFirst({
      where: { id, role: { in: MANAGEABLE_ROLES } },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async suspend(id: string) {
    const user = await this.prismaService.user.findFirst({
      where: { id, role: { in: MANAGEABLE_ROLES } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isSuspended) {
      throw new ConflictException('User is already suspended');
    }
    return this.prismaService.user.update({
      where: { id },
      data: { isSuspended: true },
      select: SAFE_USER_SELECT,
    });
  }

  async reactivate(id: string) {
    const user = await this.prismaService.user.findFirst({
      where: { id, role: { in: MANAGEABLE_ROLES } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isSuspended) {
      throw new ConflictException('User is not suspended');
    }
    return this.prismaService.user.update({
      where: { id },
      data: { isSuspended: false },
      select: SAFE_USER_SELECT,
    });
  }
}
