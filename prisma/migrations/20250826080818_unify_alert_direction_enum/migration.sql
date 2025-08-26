/*
  Warnings:

  - Changed the type of `direction` on the `PriceAlert` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `direction` on the `VolumeAlert` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('up', 'down');

-- AlterTable
ALTER TABLE "PriceAlert" DROP COLUMN "direction",
ADD COLUMN     "direction" "AlertDirection" NOT NULL;

-- AlterTable
ALTER TABLE "VolumeAlert" DROP COLUMN "direction",
ADD COLUMN     "direction" "AlertDirection" NOT NULL;

-- DropEnum
DROP TYPE "PriceAlertDirection";

-- DropEnum
DROP TYPE "VolumeAlertDirection";
