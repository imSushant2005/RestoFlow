/*
  Warnings:

  - You are about to drop the column `sessionId` on the `Review` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[diningSessionId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('INITIATED', 'SEATED', 'ORDERING', 'KITCHEN_ACTIVE', 'AWAITING_COMPLETION', 'BILL_GENERATED', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DRAFT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TableStatus" ADD VALUE 'ORDERING';
ALTER TYPE "TableStatus" ADD VALUE 'ACTIVE_MEAL';
ALTER TYPE "TableStatus" ADD VALUE 'AWAITING_BILL';
ALTER TYPE "TableStatus" ADD VALUE 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "diningSessionId" TEXT,
ADD COLUMN     "placedBy" TEXT NOT NULL DEFAULT 'customer';

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "sessionId",
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "diningSessionId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "currentSessionId" TEXT,
ADD COLUMN     "occupiedSeats" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seats" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tableId" TEXT,
    "customerId" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "sessionStatus" "SessionStatus" NOT NULL DEFAULT 'INITIATED',
    "source" TEXT NOT NULL DEFAULT 'qr',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "isBillGenerated" BOOLEAN NOT NULL DEFAULT false,
    "billGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "DiningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "DiningSession_tenantId_sessionStatus_idx" ON "DiningSession"("tenantId", "sessionStatus");

-- CreateIndex
CREATE INDEX "DiningSession_tableId_idx" ON "DiningSession"("tableId");

-- CreateIndex
CREATE INDEX "DiningSession_customerId_idx" ON "DiningSession"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_sessionId_key" ON "Bill"("sessionId");

-- CreateIndex
CREATE INDEX "Bill_tenantId_idx" ON "Bill"("tenantId");

-- CreateIndex
CREATE INDEX "Bill_sessionId_idx" ON "Bill"("sessionId");

-- CreateIndex
CREATE INDEX "Order_diningSessionId_idx" ON "Order"("diningSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_diningSessionId_key" ON "Review"("diningSessionId");

-- CreateIndex
CREATE INDEX "Review_diningSessionId_idx" ON "Review"("diningSessionId");

-- AddForeignKey
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_diningSessionId_fkey" FOREIGN KEY ("diningSessionId") REFERENCES "DiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_diningSessionId_fkey" FOREIGN KEY ("diningSessionId") REFERENCES "DiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
