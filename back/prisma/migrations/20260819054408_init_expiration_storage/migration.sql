-- CreateEnum
CREATE TYPE "ExpirationScanStatus" AS ENUM ('PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExpirationItemUnit" AS ENUM ('COUNT', 'G', 'KG', 'ML', 'L', 'PACK', 'BAG', 'BOTTLE', 'CAN');

-- CreateEnum
CREATE TYPE "ExpirationItemSource" AS ENUM ('IMAGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExpirationItemSection" AS ENUM ('DEFAULT', 'USE_SOON');

-- CreateTable
CREATE TABLE "expiration_scans" (
    "id" UUID NOT NULL,
    "status" "ExpirationScanStatus" NOT NULL DEFAULT 'PROCESSING',
    "imageKey" TEXT NOT NULL,
    "recognizedExpirationDate" DATE,
    "confidence" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expiration_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expiration_items" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "quantity" DECIMAL(9,3) NOT NULL,
    "unit" "ExpirationItemUnit" NOT NULL,
    "purchasedAt" DATE NOT NULL,
    "expirationDate" DATE,
    "imageKey" TEXT NOT NULL,
    "source" "ExpirationItemSource" NOT NULL DEFAULT 'IMAGE',
    "section" "ExpirationItemSection" NOT NULL DEFAULT 'DEFAULT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expiration_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expiration_items_scanId_key" ON "expiration_items"("scanId");

-- CreateIndex
CREATE INDEX "expiration_items_section_sortOrder_idx" ON "expiration_items"("section", "sortOrder");

-- AddForeignKey
ALTER TABLE "expiration_items" ADD CONSTRAINT "expiration_items_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "expiration_scans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
