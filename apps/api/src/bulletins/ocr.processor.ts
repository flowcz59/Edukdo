import { Injectable, Logger } from '@nestjs/common';
import { BulletinStatus, BulletinType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GradeInput, ScoringService } from '../points/scoring.service';
import { PointsService } from '../points/points.service';
import { AiService } from '../ai/ai.service';

export interface OcrResult {
  grades: GradeInput[];
  confidenceScore: number;
}

/**
 * Processes a bulletin after the image has been uploaded.
 * Steps: OCR extraction → scoring → points award → optional AI comment.
 * The AI comment step is non-blocking: failure does not reject the bulletin.
 */
@Injectable()
export class OcrProcessor {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
    private readonly pointsService: PointsService,
    private readonly aiService: AiService,
  ) {}

  async processBulletin(bulletinId: string): Promise<void> {
    await this.prisma.bulletin.update({
      where: { id: bulletinId },
      data: { status: BulletinStatus.PROCESSING },
    });

    const bulletin = await this.prisma.bulletin.findUniqueOrThrow({
      where: { id: bulletinId },
      include: { student: true },
    });

    try {
      // 1. Run OCR (mocked in development, real Textract in production)
      const ocrResult = await this.runOcr(bulletin.imageUrl);

      const needsReview = ocrResult.confidenceScore < 0.8;

      await this.prisma.bulletin.update({
        where: { id: bulletinId },
        data: {
          rawOcrData: ocrResult as any,
          extractedGrades: ocrResult.grades as any,
          status: needsReview ? BulletinStatus.NEEDS_REVIEW : BulletinStatus.VALIDATED,
          processedAt: new Date(),
        },
      });

      // 2. Calculate score
      const scoringResult = await this.scoringService.calculateScore({
        studentId: bulletin.studentId,
        bulletinId,
        type: bulletin.type,
        grades: ocrResult.grades,
        academicYear: bulletin.academicYear,
        subjectName: bulletin.subjectName,
        confidenceScore: ocrResult.confidenceScore,
      });

      // 3. Persist score and award points
      await this.prisma.bulletin.update({
        where: { id: bulletinId },
        data: {
          pointsAwarded: scoringResult.totalPoints,
          scoringDetails: scoringResult as any,
        },
      });

      await this.pointsService.awardPoints(
        bulletin.studentId,
        bulletinId,
        scoringResult,
      );

      this.logger.log(
        `Bulletin ${bulletinId} processed — ${scoringResult.totalPoints} pts awarded to student ${bulletin.studentId}`,
      );

      // 4. Generate AI comment (non-blocking — failure must never reject the bulletin)
      try {
        const previousAverage = await this.computePreviousAverage(
          bulletin.studentId,
          bulletinId,
          bulletin.type,
          bulletin.academicYear,
        );

        const comment = await this.aiService.generateBulletinComment(
          bulletin.student.firstName,
          bulletin.student.schoolLevel,
          ocrResult.grades,
          scoringResult.totalPoints,
          previousAverage,
        );

        await this.prisma.bulletin.update({
          where: { id: bulletinId },
          data: { aiComment: comment },
        });
      } catch (aiErr) {
        this.logger.error(
          `AI comment generation failed for bulletin ${bulletinId} — bulletin stays validated`,
          aiErr,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to process bulletin ${bulletinId}`, err);
      await this.prisma.bulletin.update({
        where: { id: bulletinId },
        data: { status: BulletinStatus.REJECTED },
      });
    }
  }

  /** In development, returns deterministic mock data instead of calling AWS Textract. */
  private async runOcr(imageUrl: string): Promise<OcrResult> {
    if (process.env.NODE_ENV !== 'production') {
      return {
        grades: [
          { subject: 'Mathématiques', grade: 14, maxGrade: 20, coefficient: 4 },
          { subject: 'Français', grade: 12, maxGrade: 20, coefficient: 4 },
          { subject: 'Histoire-Géo', grade: 13, maxGrade: 20, coefficient: 3 },
          { subject: 'Anglais', grade: 15, maxGrade: 20, coefficient: 3 },
          { subject: 'Physique-Chimie', grade: 11, maxGrade: 20, coefficient: 3 },
        ],
        confidenceScore: 0.92,
      };
    }

    // Production: delegate to AWS Textract (implemented in aws.service.ts)
    throw new Error(`Textract not configured for image: ${imageUrl}`);
  }

  private async computePreviousAverage(
    studentId: string,
    bulletinId: string,
    type: BulletinType,
    academicYear: string | null,
  ): Promise<number | undefined> {
    if (!academicYear) return undefined;

    const prev = await this.prisma.bulletin.findFirst({
      where: {
        studentId,
        type,
        academicYear,
        status: BulletinStatus.VALIDATED,
        id: { not: bulletinId },
      },
      orderBy: { processedAt: 'desc' },
    });

    if (!prev?.extractedGrades) return undefined;

    const grades = prev.extractedGrades as GradeInput[];
    const totalCoeff = grades.reduce((s, g) => s + (g.coefficient ?? 1), 0);
    return (
      grades.reduce((s, g) => s + (g.grade / g.maxGrade) * 20 * (g.coefficient ?? 1), 0) /
      totalCoeff
    );
  }
}
