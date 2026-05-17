import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BulletinsModule } from './bulletins/bulletins.module';
import { PointsModule } from './points/points.module';
import { ShopModule } from './shop/shop.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BulletinsModule,
    PointsModule,
    ShopModule,
    AiModule,
  ],
})
export class AppModule {}
