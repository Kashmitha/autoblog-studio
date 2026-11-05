ALTER TABLE "Article" ADD COLUMN "publishingTarget" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN "remoteStatus" TEXT,
ADD COLUMN "remoteSyncedAt" TIMESTAMP(3),
ADD COLUMN "remoteSyncError" TEXT;
ALTER TABLE "PublishJob" ADD COLUMN "target" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "Article" ADD CONSTRAINT "Article_publishingTarget_check" CHECK ("publishingTarget" IN ('local', 'blogger'));
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_target_check" CHECK ("target" IN ('local', 'blogger'));
