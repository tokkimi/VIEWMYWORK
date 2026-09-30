-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DECLINED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "pages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "page" TEXT,
    "message" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "respondedById" UUID,
    "respondedAt" TIMESTAMP(3),
    "taskId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRequest_projectId_status_idx" ON "ChangeRequest"("projectId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_workspaceId_status_idx" ON "ChangeRequest"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
