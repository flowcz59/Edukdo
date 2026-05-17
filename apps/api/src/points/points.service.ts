import { Injectable, NotFoundException } from '@nestjs/common';
import { PointEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringResult } from './scoring.service';

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Awards points to a student after bulletin validation.
   * All writes happen inside a single transaction to keep the ledger consistent.
   */
  async awardPoints(studentId: string, bulletinId: string, result: ScoringResult) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUniqueOrThrow({
        where: { id: studentId },
        select: { pointsTotal: true },
      });

      const balanceAfter = profile.pointsTotal + result.totalPoints;

      const pointEvent = await tx.pointEvent.create({
        data: {
          studentId,
          type: PointEventType.BULLETIN_REWARD,
          amount: result.totalPoints,
          balanceAfter,
          description: `Bulletin validé — ${result.totalPoints} pts`,
          bulletinId,
        },
      });

      await tx.studentProfile.update({
        where: { id: studentId },
        data: {
          pointsTotal: { increment: result.totalPoints },
          pointsEarned: { increment: result.totalPoints },
        },
      });

      return pointEvent;
    });
  }

  async getBalance(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { pointsTotal: true, pointsEarned: true, pointsSpent: true },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    return {
      totalPoints: profile.pointsTotal,
      pointsEarned: profile.pointsEarned,
      pointsSpent: profile.pointsSpent,
    };
  }

  async getHistory(userId: string, page: number, limit: number) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    const skip = (page - 1) * limit;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.pointEvent.findMany({
        where: { studentId: profile.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.pointEvent.count({ where: { studentId: profile.id } }),
    ]);

    return {
      data: events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
