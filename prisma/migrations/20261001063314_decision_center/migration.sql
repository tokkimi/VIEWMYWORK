-- AlterTable
ALTER TABLE "ScopeChange" ADD COLUMN     "askClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientComment" TEXT,
ADD COLUMN     "decidedByName" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceSetting" ADD COLUMN     "decisionReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderEveryDays" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "reminderFirstDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "reminderMax" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "ClientReminder" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "itemKey" TEXT NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "sentById" UUID,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientReminder_workspaceId_itemKey_idx" ON "ClientReminder"("workspaceId", "itemKey");

-- CreateIndex
CREATE INDEX "ClientReminder_clientId_sentAt_idx" ON "ClientReminder"("clientId", "sentAt");
