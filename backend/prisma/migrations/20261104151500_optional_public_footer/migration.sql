-- Existing article preferences stay unchanged; new drafts omit the public footer.
ALTER TABLE "Article" ALTER COLUMN "disclosure" SET DEFAULT false;
