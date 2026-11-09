CREATE TABLE "TrafficSync" (
  "id" TEXT NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "TrafficSync_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrafficSync_state_check" CHECK ("state" IN ('RUNNING','SUCCEEDED','EMPTY','FAILED')),
  CONSTRAINT "TrafficSync_trigger_check" CHECK ("trigger" IN ('automatic','manual')),
  CONSTRAINT "TrafficSync_range_check" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "TrafficSync_imported_check" CHECK ("imported" >= 0)
);
CREATE INDEX "TrafficSync_siteUrl_startedAt_idx" ON "TrafficSync"("siteUrl", "startedAt");
