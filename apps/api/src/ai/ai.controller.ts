import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BulletinStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { GenerateCommentDto } from './dto/generate-comment.dto';

interface GradeEntry {
  subject: string;
  grade: number;
  maxGrade: number;
  coefficient?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('generate-comment')
  async generateComment(@Body() dto: GenerateCommentDto) {
    const bulletin = await this.prisma.bulletin.findUnique({
      where: { id: dto.bulletinId },
      include: { student: true },
    });

    if (!bulletin) throw new NotFoundException(`Bulletin ${dto.bulletinId} not found`);

    const grades = (bulletin.extractedGrades as unknown as GradeEntry[] | null) ?? [];

    let previousAverage: number | undefined;
    if (bulletin.academicYear) {
      const previousBulletin = await this.prisma.bulletin.findFirst({
        where: {
          studentId: bulletin.studentId,
          type: bulletin.type,
          academicYear: bulletin.academicYear,
          status: BulletinStatus.VALIDATED,
          id: { not: bulletin.id },
          processedAt: { lt: bulletin.processedAt ?? new Date() },
        },
        orderBy: { processedAt: 'desc' },
      });

      if (previousBulletin?.extractedGrades) {
        const prevGrades = previousBulletin.extractedGrades as unknown as GradeEntry[];
        const totalCoeff = prevGrades.reduce((s, g) => s + (g.coefficient ?? 1), 0);
        previousAverage =
          prevGrades.reduce(
            (s, g) => s + (g.grade / g.maxGrade) * 20 * (g.coefficient ?? 1),
            0,
          ) / totalCoeff;
      }
    }

    const comment = await this.aiService.generateBulletinComment(
      bulletin.student.firstName,
      bulletin.student.schoolLevel,
      grades,
      bulletin.pointsAwarded,
      previousAverage,
    );

    await this.prisma.bulletin.update({
      where: { id: bulletin.id },
      data: { aiComment: comment },
    });

    this.logger.log(`AI comment attached to bulletin ${bulletin.id}`);
    return { comment };
  }
}
