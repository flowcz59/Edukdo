import { Injectable } from '@nestjs/common';
import { BulletinStatus, BulletinType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Configurable scoring constants — adjust without touching business logic
export const SCORING_CONSTANTS = {
  // Base score: applied to moyenneGenerale as a 0–100 percentage
  POINTS_PER_AVERAGE_POINT: 5,

  // Progression bonus: calibrated for a 0–20 grade scale
  // (internally we convert the percentage progression back to /20 before applying)
  PROGRESS_BONUS_MULTIPLIER: 20,
  MAX_PROGRESS_BONUS: 200,

  // Regularity bonus
  REGULARITY_BONUS: 50,
  REGULARITY_WINDOW_DAYS: 30,
  REGULARITY_MIN_BULLETINS: 3,

  // OCR confidence gate
  OCR_CONFIDENCE_THRESHOLD: 0.8,
  OCR_CONFIDENCE_PENALTY: 0.8, // multiply total by this factor when below threshold
} as const;

export interface GradeInput {
  subject: string;
  grade: number;
  maxGrade: number;
  coefficient?: number;
}

export interface ScoringResult {
  baseScore: number;
  progressBonus: number;
  regularityBonus: number;
  /** Points deducted due to low OCR confidence (0 when confidence is adequate) */
  confidencePenalty: number;
  totalPoints: number;
  /** Weighted average expressed as a 0–100 percentage */
  moyenneGenerale: number;
  /** Previous bulletin's moyenneGenerale (0–100), or null for the first bulletin */
  previousMoyenne: number | null;
}

export interface CalculateScoreInput {
  studentId: string;
  /** ID of the bulletin being scored — excluded from "previous bulletin" queries */
  bulletinId: string;
  type: BulletinType;
  grades: GradeInput[];
  academicYear?: string | null;
  subjectName?: string | null;
  confidenceScore: number;
}

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateScore(input: CalculateScoreInput): Promise<ScoringResult> {
    if (input.type === BulletinType.DEVOIR) {
      return this.calculateDevoirScore(input);
    }
    return this.calculateBulletinScore(input);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Weighted average of grades expressed as a percentage (0–100).
   * Uses coefficient = 1 when not provided.
   */
  private calculateMoyenneGenerale(grades: GradeInput[]): number {
    const totalCoeff = grades.reduce((sum, g) => sum + (g.coefficient ?? 1), 0);
    const weightedSum = grades.reduce(
      (sum, g) => sum + (g.grade / g.maxGrade) * 100 * (g.coefficient ?? 1),
      0,
    );
    return weightedSum / totalCoeff;
  }

  private applyConfidencePenalty(
    rawTotal: number,
    confidenceScore: number,
  ): { totalPoints: number; confidencePenalty: number } {
    const C = SCORING_CONSTANTS;
    if (confidenceScore < C.OCR_CONFIDENCE_THRESHOLD) {
      const totalPoints = Math.floor(rawTotal * C.OCR_CONFIDENCE_PENALTY);
      return { totalPoints, confidencePenalty: rawTotal - totalPoints };
    }
    return { totalPoints: rawTotal, confidencePenalty: 0 };
  }

  // ─── BULLETIN_TRIMESTRIEL ────────────────────────────────────────────────

  private async calculateBulletinScore(input: CalculateScoreInput): Promise<ScoringResult> {
    const { studentId, bulletinId, grades, academicYear, confidenceScore } = input;
    const C = SCORING_CONSTANTS;

    // Step 1 — Base score
    const moyenneGenerale = this.calculateMoyenneGenerale(grades);
    const baseScore = Math.floor(moyenneGenerale * C.POINTS_PER_AVERAGE_POINT);

    // Step 2 — Progress bonus
    const { progressBonus, previousMoyenne } = await this.computeProgressBonus(
      studentId,
      bulletinId,
      BulletinType.BULLETIN_TRIMESTRIEL,
      moyenneGenerale,
      academicYear,
    );

    // Step 3 — Regularity bonus
    const regularityBonus = await this.computeRegularityBonus(studentId);

    const rawTotal = baseScore + progressBonus + regularityBonus;
    const { totalPoints, confidencePenalty } = this.applyConfidencePenalty(rawTotal, confidenceScore);

    return {
      baseScore,
      progressBonus,
      regularityBonus,
      confidencePenalty,
      totalPoints,
      moyenneGenerale,
      previousMoyenne,
    };
  }

  // ─── DEVOIR ──────────────────────────────────────────────────────────────

  private async calculateDevoirScore(input: CalculateScoreInput): Promise<ScoringResult> {
    const { studentId, bulletinId, grades, subjectName, confidenceScore } = input;
    const C = SCORING_CONSTANTS;

    const grade = grades[0];
    const scorePercent = (grade.grade / grade.maxGrade) * 100;
    const baseScore = Math.floor(scorePercent);

    // Progress bonus only when a previous devoir for the same subject exists
    let progressBonus = 0;
    let previousMoyenne: number | null = null;

    if (subjectName) {
      const result = await this.computeProgressBonus(
        studentId,
        bulletinId,
        BulletinType.DEVOIR,
        scorePercent,
        null,
        subjectName,
      );
      progressBonus = result.progressBonus;
      previousMoyenne = result.previousMoyenne;
    }

    // No regularity bonus for devoirs
    const rawTotal = baseScore + progressBonus;
    const { totalPoints, confidencePenalty } = this.applyConfidencePenalty(rawTotal, confidenceScore);

    return {
      baseScore,
      progressBonus,
      regularityBonus: 0,
      confidencePenalty,
      totalPoints,
      moyenneGenerale: scorePercent,
      previousMoyenne,
    };
  }

  // ─── Shared sub-calculations ─────────────────────────────────────────────

  private async computeProgressBonus(
    studentId: string,
    bulletinId: string,
    type: BulletinType,
    moyenneActuelle: number,
    academicYear?: string | null,
    subjectName?: string | null,
  ): Promise<{ progressBonus: number; previousMoyenne: number | null }> {
    const C = SCORING_CONSTANTS;

    const previousBulletin = await this.prisma.bulletin.findFirst({
      where: {
        studentId,
        type,
        status: BulletinStatus.VALIDATED,
        id: { not: bulletinId },
        ...(academicYear ? { academicYear } : {}),
        ...(subjectName ? { subjectName } : {}),
      },
      orderBy: { processedAt: 'desc' },
      select: { extractedGrades: true },
    });

    if (!previousBulletin?.extractedGrades) {
      return { progressBonus: 0, previousMoyenne: null };
    }

    const prevGrades = previousBulletin.extractedGrades as GradeInput[];
    const previousMoyenne = this.calculateMoyenneGenerale(prevGrades);
    const progression = moyenneActuelle - previousMoyenne;

    if (progression <= 0) {
      return { progressBonus: 0, previousMoyenne };
    }

    // PROGRESS_BONUS_MULTIPLIER = 20 is calibrated for a 0–20 scale.
    // Both moyennes are percentages (0–100), so divide progression by 5
    // to convert to the /20 equivalent before applying the multiplier.
    const progressBonus = Math.min(
      Math.floor((progression / 5) * C.PROGRESS_BONUS_MULTIPLIER),
      C.MAX_PROGRESS_BONUS,
    );

    return { progressBonus, previousMoyenne };
  }

  private async computeRegularityBonus(studentId: string): Promise<number> {
    const C = SCORING_CONSTANTS;

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - C.REGULARITY_WINDOW_DAYS);

    const count = await this.prisma.bulletin.count({
      where: {
        studentId,
        status: BulletinStatus.VALIDATED,
        processedAt: { gte: windowStart },
      },
    });

    return count >= C.REGULARITY_MIN_BULLETINS ? C.REGULARITY_BONUS : 0;
  }
}
