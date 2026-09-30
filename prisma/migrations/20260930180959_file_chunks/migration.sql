-- CreateTable
CREATE TABLE "FileChunk" (
    "key" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "FileChunk_pkey" PRIMARY KEY ("key","idx")
);
