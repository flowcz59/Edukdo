import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  onModuleInit() {
    if (!process.env.JWT_SECRET) {
      throw new Error(
        'JWT_SECRET est manquant dans les variables d\'environnement. ' +
        'Copiez .env.example en .env et renseignez les valeurs.',
      );
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT_REFRESH_SECRET est manquant dans les variables d\'environnement.',
      );
    }
    this.logger.log('Auth module initialisé');
  }
}
