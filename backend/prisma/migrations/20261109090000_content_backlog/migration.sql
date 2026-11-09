ALTER TABLE "Article"
ADD COLUMN "backlogPriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "planningNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Article" ADD CONSTRAINT "Article_backlogPriority_check" CHECK ("backlogPriority" BETWEEN 0 AND 3);
