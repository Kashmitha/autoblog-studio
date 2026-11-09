CREATE TABLE "FetchDiagnostic" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "result" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "FetchDiagnostic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FetchDiagnostic_state_check" CHECK ("state" IN ('RUNNING','COMPLETED','FAILED')),
  CONSTRAINT "FetchDiagnostic_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FetchDiagnostic_articleId_url_startedAt_idx" ON "FetchDiagnostic"("articleId","url","startedAt");
CREATE UNIQUE INDEX "FetchDiagnostic_active_url_idx" ON "FetchDiagnostic"("articleId","url") WHERE "state" = 'RUNNING';
