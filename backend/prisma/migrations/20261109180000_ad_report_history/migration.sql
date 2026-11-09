CREATE TABLE "AdReport" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "scopeLabel" TEXT NOT NULL DEFAULT '',
  "timezoneLabel" TEXT NOT NULL DEFAULT '',
  "report" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdReport_fingerprint_key" ON "AdReport"("fingerprint");
CREATE INDEX "AdReport_createdAt_idx" ON "AdReport"("createdAt");
