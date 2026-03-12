-- AlterTable: Make slotId nullable in appointments so hard-deleted slots don't violate FK constraints
ALTER TABLE "appointments" ALTER COLUMN "slotId" DROP NOT NULL;
