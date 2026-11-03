/*
  Warnings:

  - You are about to drop the column `seatNumbers` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `totalSeats` on the `Bus` table. All the data in the column will be lost.
  - You are about to drop the column `seatNumber` on the `Passenger` table. All the data in the column will be lost.
  - You are about to drop the `BookingSeat` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Seat` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SeatHold` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BookingSeat" DROP CONSTRAINT "BookingSeat_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "BookingSeat" DROP CONSTRAINT "BookingSeat_seatId_fkey";

-- DropForeignKey
ALTER TABLE "BookingSeat" DROP CONSTRAINT "BookingSeat_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Seat" DROP CONSTRAINT "Seat_busId_fkey";

-- DropForeignKey
ALTER TABLE "SeatHold" DROP CONSTRAINT "SeatHold_seatId_fkey";

-- DropForeignKey
ALTER TABLE "SeatHold" DROP CONSTRAINT "SeatHold_tripId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "seatNumbers",
ALTER COLUMN "contactEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Bus" DROP COLUMN "totalSeats",
ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Passenger" DROP COLUMN "seatNumber",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Settings" ALTER COLUMN "adminEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "bookingClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "BookingSeat";

-- DropTable
DROP TABLE "Seat";

-- DropTable
DROP TABLE "SeatHold";

-- DropEnum
DROP TYPE "SeatType";

-- CreateTable
CREATE TABLE "BusPhoto" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusPhoto_busId_position_idx" ON "BusPhoto"("busId", "position");

-- AddForeignKey
ALTER TABLE "BusPhoto" ADD CONSTRAINT "BusPhoto_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
