-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "weeklyReport" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "WorkspaceSetting" ADD COLUMN     "clientReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastTeamDigestAt" TIMESTAMP(3),
ADD COLUMN     "reportWeekday" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "teamDigest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProjectReport" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "note" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "sentById" UUID,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectReport_projectId_createdAt_idx" ON "ProjectReport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectReport_workspaceId_createdAt_idx" ON "ProjectReport"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
