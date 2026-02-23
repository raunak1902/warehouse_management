/*
  Warnings:

  - You are about to drop the column `subscriptionEnd` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionStart` on the `Client` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[barcode]` on the table `Device` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `barcode` to the `Device` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_setId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceSet" DROP CONSTRAINT "DeviceSet_clientId_fkey";

-- DropIndex
DROP INDEX "Client_subscriptionEnd_idx";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "subscriptionEnd",
DROP COLUMN "subscriptionStart";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "barcode" TEXT NOT NULL,
ADD COLUMN     "deployedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" INTEGER;

-- AlterTable
ALTER TABLE "DeviceSet" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" INTEGER,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AssignmentRequest" (
    "id" SERIAL NOT NULL,
    "requestType" TEXT NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'ok',
    "healthComment" TEXT,
    "returnType" TEXT NOT NULL,
    "returnDays" INTEGER,
    "returnMonths" INTEGER,
    "returnDate" TIMESTAMP(3),
    "computedReturnDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" INTEGER,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceHistory" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DeviceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentRequest_status_idx" ON "AssignmentRequest"("status");

-- CreateIndex
CREATE INDEX "AssignmentRequest_clientId_idx" ON "AssignmentRequest"("clientId");

-- CreateIndex
CREATE INDEX "AssignmentRequest_deviceId_idx" ON "AssignmentRequest"("deviceId");

-- CreateIndex
CREATE INDEX "AssignmentRequest_setId_idx" ON "AssignmentRequest"("setId");

-- CreateIndex
CREATE INDEX "DeviceHistory_deviceId_idx" ON "DeviceHistory"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_barcode_key" ON "Device"("barcode");

-- CreateIndex
CREATE INDEX "Device_barcode_idx" ON "Device"("barcode");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_setId_fkey" FOREIGN KEY ("setId") REFERENCES "DeviceSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSet" ADD CONSTRAINT "DeviceSet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHistory" ADD CONSTRAINT "DeviceHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
