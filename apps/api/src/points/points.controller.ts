import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PointsService } from './points.service';
import { GetHistoryDto } from './dto/get-history.dto';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.pointsService.getBalance(user.sub);
  }

  @Get('history')
  getHistory(@CurrentUser() user: JwtPayload, @Query() query: GetHistoryDto) {
    return this.pointsService.getHistory(user.sub, query.page, query.limit);
  }
}
