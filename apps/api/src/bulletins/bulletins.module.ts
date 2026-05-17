import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { PointsModule } from '../points/points.module';
import { BulletinsController } from './bulletins.controller';
import { BulletinsService } from './bulletins.service';
import { OcrProcessor } from './ocr.processor';
import { OcrService } from './ocr.service';
import { StorageService } from './storage.service';

@Module({
  imports: [PrismaModule, AuthModule, AiModule, PointsModule],
  controllers: [BulletinsController],
  providers: [BulletinsService, StorageService, OcrService, OcrProcessor],
  exports: [BulletinsService],
})
export class BulletinsModule {}
