-- CreateEnum
CREATE TYPE "PriceAlertDirection" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "DiscordServer" (
    "id" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "DiscordServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "discordServerId" TEXT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "direction" "PriceAlertDirection" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "alertId" TEXT NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordServer_id_key" ON "DiscordServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_alertId_key" ON "PriceAlert"("alertId");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_discordServerId_fkey" FOREIGN KEY ("discordServerId") REFERENCES "DiscordServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
