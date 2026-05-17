import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { RewardCategory } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { ShopService } from './shop.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('rewards')
  findAllRewards(
    @Query('category') category?: RewardCategory,
    @Query('maxCost') maxCost?: string,
  ) {
    return this.shopService.findAllRewards(
      category,
      maxCost !== undefined ? parseInt(maxCost, 10) : undefined,
    );
  }

  @Get('rewards/:id')
  findOneReward(@Param('id') id: string) {
    return this.shopService.findOneReward(id);
  }

  @Post('orders')
  createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.shopService.createOrder(user.sub, dto.rewardId);
  }

  @Get('orders')
  findAllOrders(@CurrentUser() user: JwtPayload) {
    return this.shopService.findAllOrders(user.sub);
  }

  @Post('orders/:id/cancel')
  cancelOrder(@CurrentUser() user: JwtPayload, @Param('id') orderId: string) {
    return this.shopService.cancelOrder(orderId, user.sub);
  }
}
