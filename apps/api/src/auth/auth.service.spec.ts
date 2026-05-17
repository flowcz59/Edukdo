import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  describe('register', () => {
    it('crée un compte élève et retourne user + tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const createdUser = {
        id: 'user-id-1',
        email: 'eleve@test.fr',
        role: Role.STUDENT,
        createdAt: new Date(),
        studentProfile: {
          firstName: 'Alice',
          lastName: 'Martin',
          birthDate: new Date('2008-03-15'),
          schoolLevel: 'SECONDE',
          pointsTotal: 0,
          pointsEarned: 0,
          pointsSpent: 0,
        },
        parentProfile: null,
      };
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.register({
        email: 'eleve@test.fr',
        password: 'Test1234!',
        role: Role.STUDENT,
        firstName: 'Alice',
        lastName: 'Martin',
        birthDate: '2008-03-15',
        schoolLevel: 'SECONDE' as any,
      });

      expect(result.user.email).toBe('eleve@test.fr');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // passwordHash ne doit jamais apparaître dans la réponse
      expect((result.user as any).passwordHash).toBeUndefined();

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'eleve@test.fr' },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledTimes(1);
    });

    it('lève ConflictException si l\'email existe déjà', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing',
        email: 'eleve@test.fr',
      });

      await expect(
        service.register({
          email: 'eleve@test.fr',
          password: 'Test1234!',
          role: Role.STUDENT,
          firstName: 'Alice',
          lastName: 'Martin',
          birthDate: '2008-03-15',
          schoolLevel: 'SECONDE' as any,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('retourne les tokens avec un mot de passe correct', async () => {
      const passwordHash = await bcrypt.hash('Test1234!', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'eleve@test.fr',
        role: Role.STUDENT,
        passwordHash,
        createdAt: new Date(),
        studentProfile: { firstName: 'Alice' },
        parentProfile: null,
      });
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'eleve@test.fr',
        password: 'Test1234!',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('lève UnauthorizedException avec un mauvais mot de passe', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword1!', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'eleve@test.fr',
        role: Role.STUDENT,
        passwordHash,
        createdAt: new Date(),
        studentProfile: null,
        parentProfile: null,
      });

      await expect(
        service.login({
          email: 'eleve@test.fr',
          password: 'WrongPassword9!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.refreshToken.create).not.toHaveBeenCalled();
    });

    it('lève UnauthorizedException si l\'email est introuvable', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'inconnu@test.fr', password: 'Test1234!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
