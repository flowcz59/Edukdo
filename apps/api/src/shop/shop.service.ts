import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus, PointEventType, RewardCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllRewards(category?: RewardCategory, maxCost?: number) {
    return this.prisma.reward.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
        ...(maxCost !== undefined ? { pointsCost: { lte: maxCost } } : {}),
      },
      orderBy: { pointsCost: 'asc' },
    });
  }

  async findOneReward(id: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException('Récompense introuvable');
    return reward;
  }

  async createOrder(userId: string, rewardId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Retrieve student profile with current balance
      const student = await tx.studentProfile.findUnique({
        where: { userId },
        select: { id: true, pointsTotal: true, pointsSpent: true, parentId: true },
      });
      if (!student) throw new NotFoundException('Profil élève introuvable');

      // 2. Retrieve reward and verify it is active
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.isActive) throw new NotFoundException('Récompense introuvable');

      // 3. Check sufficient balance
      if (student.pointsTotal < reward.pointsCost) {
        throw new BadRequestException('Solde de points insuffisant');
      }

      // 4. Check and decrement stock (-1 = unlimited)
      if (reward.stock === 0) {
        throw new BadRequestException('Récompense épuisée');
      }
      if (reward.stock > 0) {
        await tx.reward.update({
          where: { id: rewardId },
          data: { stock: { decrement: 1 } },
        });
      }

      // 5. Determine order status based on parent linkage
      const hasParent = !!student.parentId;
      const balanceAfter = student.pointsTotal - reward.pointsCost;

      // 6–7. Debit points and update profile
      await tx.studentProfile.update({
        where: { id: student.id },
        data: {
          pointsTotal: { decrement: reward.pointsCost },
          pointsSpent: { increment: reward.pointsCost },
        },
      });

      // 8. Create the order, then link the PointEvent to it
      const voucherCode = !hasParent ? generateVoucherCode() : undefined;
      const now = new Date();

      const order = await tx.order.create({
        data: {
          studentId: student.id,
          rewardId,
          pointsSpent: reward.pointsCost,
          status: hasParent ? OrderStatus.PENDING_PARENT_APPROVAL : OrderStatus.DELIVERED,
          parentId: student.parentId ?? undefined,
          voucherCode,
          deliveredAt: !hasParent ? now : undefined,
        },
        include: { reward: true },
      });

      await tx.pointEvent.create({
        data: {
          studentId: student.id,
          type: PointEventType.SHOP_REDEMPTION,
          amount: -reward.pointsCost,
          balanceAfter,
          description: `Commande — ${reward.name}`,
          orderId: order.id,
        },
      });

      return order;
    });
  }

  async findAllOrders(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Profil élève introuvable');

    return this.prisma.order.findMany({
      where: { studentId: student.id },
      include: { reward: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelOrder(orderId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.studentProfile.findUnique({
        where: { userId },
        select: { id: true, pointsTotal: true, pointsSpent: true },
      });
      if (!student) throw new NotFoundException('Profil élève introuvable');

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.studentId !== student.id) {
        throw new NotFoundException('Commande introuvable');
      }
      if (order.status !== OrderStatus.PENDING_PARENT_APPROVAL) {
        throw new BadRequestException(
          'Seules les commandes en attente de validation parentale peuvent être annulées',
        );
      }

      const balanceAfter = student.pointsTotal + order.pointsSpent;

      // Recredit points via ADMIN_ADJUSTMENT event
      await tx.pointEvent.create({
        data: {
          studentId: student.id,
          type: PointEventType.ADMIN_ADJUSTMENT,
          amount: order.pointsSpent,
          balanceAfter,
          description: `Annulation commande — remboursement ${order.pointsSpent} pts`,
          orderId: order.id,
        },
      });

      await tx.studentProfile.update({
        where: { id: student.id },
        data: {
          pointsTotal: { increment: order.pointsSpent },
          pointsSpent: { decrement: order.pointsSpent },
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: { reward: true },
      });
    });
  }
}
