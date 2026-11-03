-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('waiting', 'scheduled', 'dismissed');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('morning', 'afternoon', 'night', 'any');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "requestMinDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "requestMinPeople" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "TripRequest" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "preferredTime" "TimeSlot" NOT NULL DEFAULT 'any',
    "fullName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "passengers" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'waiting',
    "tripId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripRequest_routeId_date_status_idx" ON "TripRequest"("routeId", "date", "status");

-- CreateIndex
CREATE INDEX "TripRequest_status_date_idx" ON "TripRequest"("status", "date");

-- AddForeignKey
ALTER TABLE "TripRequest" ADD CONSTRAINT "TripRequest_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRequest" ADD CONSTRAINT "TripRequest_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
