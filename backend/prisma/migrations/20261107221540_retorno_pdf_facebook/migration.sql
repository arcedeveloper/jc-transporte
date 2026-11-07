-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "facebook" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "pdfId" TEXT,
ADD COLUMN     "returnTime" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TripPdf" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPdf_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_pdfId_fkey" FOREIGN KEY ("pdfId") REFERENCES "TripPdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
