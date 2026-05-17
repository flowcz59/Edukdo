import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';

@Module({
  controllers: [PointsController],
  providers: [ScoringService, PointsService],
  exports: [ScoringService, PointsService],
})
export class PointsModule {}
