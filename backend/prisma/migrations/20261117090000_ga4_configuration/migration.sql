ALTER TABLE "ReportingSettings"
  ADD COLUMN "gaPropertyId" TEXT,
  ADD COLUMN "gaMeasurementId" TEXT,
  ADD COLUMN "gaBlogUrl" TEXT,
  ADD COLUMN "gaTimeZone" TEXT,
  ADD COLUMN "gaVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "gaRevision" INTEGER NOT NULL DEFAULT 0;
