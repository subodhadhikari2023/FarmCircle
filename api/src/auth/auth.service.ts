import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: hash,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }
}
