CREATE TABLE "ReportingSettings" (
  "id" TEXT NOT NULL DEFAULT 'owner',
  "searchConsoleSiteUrl" TEXT,
  "propertyVerifiedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportingSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IndexInspection" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "inspectionUrl" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "verdict" TEXT,
  "coverageState" TEXT,
  "robotsTxtState" TEXT,
  "indexingState" TEXT,
  "pageFetchState" TEXT,
  "lastCrawlTime" TIMESTAMP(3),
  "crawledAs" TEXT,
  "googleCanonical" TEXT,
  "userCanonical" TEXT,
  "sitemaps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "referringUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "inspectionResultLink" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndexInspection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "index_inspection_state" CHECK ("state" IN ('INDEXED','NOT_INDEXED','UNKNOWN','ERROR')),
  CONSTRAINT "IndexInspection_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "IndexInspection_articleId_siteUrl_inspectionUrl_checkedAt_idx" ON "IndexInspection"("articleId", "siteUrl", "inspectionUrl", "checkedAt");
