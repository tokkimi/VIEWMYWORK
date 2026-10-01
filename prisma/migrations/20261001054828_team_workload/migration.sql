-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN     "hourlyCostCents" INTEGER,
ADD COLUMN     "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 2100;

-- CreateTable
CREATE TABLE "MemberAbsence" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'LEAVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberAbsence_workspaceId_startDate_idx" ON "MemberAbsence"("workspaceId", "startDate");

-- CreateIndex
CREATE INDEX "MemberAbsence_memberId_idx" ON "MemberAbsence"("memberId");

-- AddForeignKey
ALTER TABLE "MemberAbsence" ADD CONSTRAINT "MemberAbsence_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
