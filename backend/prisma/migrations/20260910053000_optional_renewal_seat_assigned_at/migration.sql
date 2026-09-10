-- AlterTable
ALTER TABLE "public"."Subscription" ALTER COLUMN "renewalDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Seat" ADD COLUMN "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
