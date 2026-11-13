CREATE TABLE "EditorialSettings" (
 "id" TEXT NOT NULL DEFAULT 'owner', "enabled" BOOLEAN NOT NULL DEFAULT false,
 "autoPublish" BOOLEAN NOT NULL DEFAULT false, "blogId" TEXT,
 "times" TEXT[] DEFAULT ARRAY['09:00','17:00']::TEXT[], "revision" INTEGER NOT NULL DEFAULT 1,
 "authorizedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "EditorialSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EditorialRun" (
 "id" TEXT NOT NULL, "slotKey" TEXT NOT NULL, "slotAt" TIMESTAMP(3) NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'QUEUED', "stage" TEXT NOT NULL DEFAULT 'QUEUED',
 "articleId" TEXT, "articleVersion" INTEGER, "policyRevision" INTEGER NOT NULL, "blogId" TEXT,
 "message" TEXT NOT NULL DEFAULT '', "candidates" JSONB NOT NULL DEFAULT '[]',
 "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EditorialRun_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "EditorialRun_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EditorialRun_slotKey_key" ON "EditorialRun"("slotKey");
CREATE UNIQUE INDEX "EditorialRun_articleId_key" ON "EditorialRun"("articleId");
CREATE INDEX "EditorialRun_state_slotAt_idx" ON "EditorialRun"("state","slotAt");
