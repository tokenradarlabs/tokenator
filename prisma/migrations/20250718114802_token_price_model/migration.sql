-- CreateTable
CREATE TABLE "TokenPrice" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenId" TEXT NOT NULL,

    CONSTRAINT "TokenPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenPrice_timestamp_idx" ON "TokenPrice"("timestamp");

-- CreateIndex
CREATE INDEX "TokenPrice_tokenId_idx" ON "TokenPrice"("tokenId");

-- AddForeignKey
ALTER TABLE "TokenPrice" ADD CONSTRAINT "TokenPrice_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
