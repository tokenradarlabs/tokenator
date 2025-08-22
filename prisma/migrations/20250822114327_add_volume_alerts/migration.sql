-- CreateEnum
CREATE TYPE "VolumeAlertDirection" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "VolumeAlert" (
    "id" TEXT NOT NULL,
    "direction" "VolumeAlertDirection" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "alertId" TEXT NOT NULL,

    CONSTRAINT "VolumeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenVolume" (
    "id" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenId" TEXT NOT NULL,

    CONSTRAINT "TokenVolume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VolumeAlert_alertId_key" ON "VolumeAlert"("alertId");

-- CreateIndex
CREATE INDEX "TokenVolume_timestamp_idx" ON "TokenVolume"("timestamp");

-- CreateIndex
CREATE INDEX "TokenVolume_tokenId_idx" ON "TokenVolume"("tokenId");

-- AddForeignKey
ALTER TABLE "VolumeAlert" ADD CONSTRAINT "VolumeAlert_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenVolume" ADD CONSTRAINT "TokenVolume_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
