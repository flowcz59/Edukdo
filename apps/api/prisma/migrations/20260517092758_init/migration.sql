-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'PARENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE');

-- CreateEnum
CREATE TYPE "BulletinType" AS ENUM ('BULLETIN_TRIMESTRIEL', 'DEVOIR');

-- CreateEnum
CREATE TYPE "BulletinStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PointEventType" AS ENUM ('BULLETIN_REWARD', 'BONUS_REGULARITY', 'SHOP_REDEMPTION', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('CINEMA', 'STREAMING', 'LIVRES_CULTURE', 'PARC_ATTRACTION', 'CARTE_CADEAU', 'MUSEE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PARENT_APPROVAL', 'APPROVED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "schoolLevel" "SchoolLevel" NOT NULL,
    "schoolName" TEXT,
    "pointsTotal" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "pointsSpent" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bulletin" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "BulletinType" NOT NULL,
    "status" "BulletinStatus" NOT NULL DEFAULT 'PENDING',
    "imageUrl" TEXT NOT NULL,
    "rawOcrData" JSONB,
    "extractedGrades" JSONB,
    "trimester" INTEGER,
    "academicYear" TEXT,
    "subjectName" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "scoringDetails" JSONB,
    "aiComment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "PointEventType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "bulletinId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RewardCategory" NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerLogo" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT -1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "termsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PARENT_APPROVAL',
    "parentId" TEXT,
    "parentApprovedAt" TIMESTAMP(3),
    "voucherCode" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PointEvent_bulletinId_key" ON "PointEvent"("bulletinId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "Bulletin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
