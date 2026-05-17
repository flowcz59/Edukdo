import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BulletinStatus, BulletinType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadBulletinDto } from './dto/upload-bulletin.dto';
import { OcrProcessor } from './ocr.processor';
import { StorageService } from './storage.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class BulletinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly ocrProcessor: OcrProcessor,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
    dto: UploadBulletinDto,
  ) {
    this.validateFile(file);

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException(
        'Profil élève introuvable pour cet utilisateur.',
      );
    }

    if (
      dto.type === BulletinType.DEVOIR &&
      (!dto.subjectName || dto.subjectName.trim() === '')
    ) {
      throw new BadRequestException(
        'Le champ subjectName est requis pour un devoir.',
      );
    }

    const imageUrl = await this.storageService.store(
      file.buffer,
      student.id,
      file.originalname,
      file.mimetype,
    );

    const bulletin = await this.prisma.bulletin.create({
      data: {
        studentId: student.id,
        type: dto.type,
        status: BulletinStatus.PENDING,
        imageUrl,
        trimester: dto.trimester ?? null,
        academicYear: dto.academicYear ?? null,
        subjectName: dto.subjectName ?? null,
      },
    });

    // Fire-and-forget : l'OCR tourne en arrière-plan, on répond immédiatement
    setImmediate(() => {
      this.ocrProcessor.processBulletin(bulletin.id).catch(() => {
        // Erreur déjà loggée dans OcrProcessor
      });
    });

    return { id: bulletin.id, status: bulletin.status };
  }

  async findAll(
    userId: string,
    page: number,
    limit: number,
    status?: BulletinStatus,
  ) {
    const student = await this.requireStudentProfile(userId);
    const skip = (page - 1) * limit;
    const where = {
      studentId: student.id,
      ...(status ? { status } : {}),
    };

    const [bulletins, total] = await Promise.all([
      this.prisma.bulletin.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          trimester: true,
          academicYear: true,
          subjectName: true,
          pointsAwarded: true,
          submittedAt: true,
          processedAt: true,
        },
      }),
      this.prisma.bulletin.count({ where }),
    ]);

    return {
      data: bulletins,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, bulletinId: string) {
    const student = await this.requireStudentProfile(userId);

    const bulletin = await this.prisma.bulletin.findUnique({
      where: { id: bulletinId },
    });

    if (!bulletin) {
      throw new NotFoundException('Bulletin introuvable.');
    }
    if (bulletin.studentId !== student.id) {
      throw new ForbiddenException(
        'Accès refusé : ce bulletin ne vous appartient pas.',
      );
    }

    return bulletin;
  }

  private async requireStudentProfile(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException(
        'Profil élève introuvable pour cet utilisateur.',
      );
    }
    return student;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni.');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non accepté. Types autorisés : ${ALLOWED_MIME_TYPES.join(', ')}.`,
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        'Fichier trop volumineux. Taille maximale : 10 MB.',
      );
    }
  }
}
