import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    if (dto.role === Role.STUDENT && !dto.birthDate) {
      throw new BadRequestException(
        'La date de naissance est requise pour un compte élève',
      );
    }
    if (dto.role === Role.STUDENT && !dto.schoolLevel) {
      throw new BadRequestException(
        'Le niveau scolaire est requis pour un compte élève',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        ...(dto.role === Role.STUDENT && {
          studentProfile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              birthDate: new Date(dto.birthDate),
              schoolLevel: dto.schoolLevel,
            },
          },
        }),
        ...(dto.role === Role.PARENT && {
          parentProfile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
            },
          },
        }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        studentProfile: true,
        parentProfile: true,
      },
    });

    const tokens = await this._generateTokens(user.id, user.role);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        createdAt: true,
        studentProfile: true,
        parentProfile: true,
      },
    });

    if (!user) {
      this.logger.warn(`Tentative de connexion échouée : email introuvable — ${dto.email}`);
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`Tentative de connexion échouée : mauvais mot de passe — ${dto.email}`);
      throw new UnauthorizedException('Identifiants invalides');
    }

    const { passwordHash: _removed, ...userWithoutHash } = user;
    const tokens = await this._generateTokens(user.id, user.role);
    return { user: userWithoutHash, ...tokens };
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = await bcrypt.hash(dto.refreshToken, BCRYPT_SALT_ROUNDS);

    // Find by iterating since we store hashed tokens — compare each
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, role: true } } },
    });

    let matchedToken = null;
    for (const stored of storedTokens) {
      const match = await bcrypt.compare(dto.refreshToken, stored.token);
      if (match) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    // Rotate: delete old token, create new pair
    await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });

    const tokens = await this._generateTokens(
      matchedToken.user.id,
      matchedToken.user.role,
    );
    return tokens;
  }

  async logout(dto: RefreshDto) {
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
    });

    for (const stored of storedTokens) {
      const match = await bcrypt.compare(dto.refreshToken, stored.token);
      if (match) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
        return { message: 'Déconnexion réussie' };
      }
    }

    // Silently succeed even if token not found (already logged out or expired)
    return { message: 'Déconnexion réussie' };
  }

  private async _generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
    });

    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, BCRYPT_SALT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
