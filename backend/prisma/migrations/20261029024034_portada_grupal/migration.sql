/*
  Warnings:

  - You are about to drop the column `requestMinDays` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `requestMinPeople` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the `TripRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PromoLayout" AS ENUM ('square', 'wide');

-- CreateEnum
CREATE TYPE "GroupRequestStatus" AS ENUM ('new', 'contacted', 'accepted', 'dismissed');

-- DropForeignKey
ALTER TABLE "TripRequest" DROP CONSTRAINT "TripRequest_routeId_fkey";

-- DropForeignKey
ALTER TABLE "TripRequest" DROP CONSTRAINT "TripRequest_tripId_fkey";

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "requestMinDays",
DROP COLUMN "requestMinPeople",
ADD COLUMN     "groupMaxPeople" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "groupMinDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "groupMinPeople" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "promoImageId" TEXT,
ADD COLUMN     "promoLayout" "PromoLayout" NOT NULL DEFAULT 'square',
ADD COLUMN     "promoText" TEXT,
ADD COLUMN     "promoTitle" TEXT,
ADD COLUMN     "showOnHome" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "TripRequest";

-- DropEnum
DROP TYPE "RequestStatus";

-- CreateTable
CREATE TABLE "PromoImage" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRequest" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "returnDate" TEXT,
    "preferredTime" "TimeSlot" NOT NULL DEFAULT 'any',
    "passengers" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "notes" TEXT,
    "status" "GroupRequestStatus" NOT NULL DEFAULT 'new',
    "tripId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "origin" TEXT,
    "whenText" TEXT,
    "message" TEXT,
    "name" TEXT,
    "contactPhone" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupRequest_status_date_idx" ON "GroupRequest"("status", "date");

-- CreateIndex
CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_promoImageId_fkey" FOREIGN KEY ("promoImageId") REFERENCES "PromoImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRequest" ADD CONSTRAINT "GroupRequest_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
