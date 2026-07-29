import { Module } from '@nestjs/common';
import { CropsController } from './crops.controller';
import { VarietiesController } from './varieties.controller';
import { CropsService } from './crops.service';
import { VarietiesService } from './varieties.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CropsController, VarietiesController],
  providers: [CropsService, VarietiesService],
})
export class CatalogModule {}
