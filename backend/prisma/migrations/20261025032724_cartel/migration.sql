-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "signMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "signShowRoutes" BOOLEAN NOT NULL DEFAULT true;
