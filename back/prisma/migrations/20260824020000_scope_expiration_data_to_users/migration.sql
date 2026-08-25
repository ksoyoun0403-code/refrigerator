-- Add ownership columns as nullable while existing development data is migrated.
ALTER TABLE "expiration_scans" ADD COLUMN "userId" UUID;
ALTER TABLE "expiration_items" ADD COLUMN "userId" UUID;

-- This project had a single shared refrigerator before authentication. Preserve
-- that data by assigning it to the oldest registered user. On a fresh database
-- these tables are empty, so the update is a no-op.
UPDATE "expiration_scans"
SET "userId" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "userId" IS NULL;

UPDATE "expiration_items"
SET "userId" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "userId" IS NULL;

ALTER TABLE "expiration_scans" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "expiration_items" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX "expiration_items_section_sortOrder_idx";

CREATE INDEX "expiration_scans_userId_createdAt_idx" ON "expiration_scans"("userId", "createdAt");
CREATE INDEX "expiration_items_userId_section_sortOrder_idx" ON "expiration_items"("userId", "section", "sortOrder");

ALTER TABLE "expiration_scans" ADD CONSTRAINT "expiration_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expiration_items" ADD CONSTRAINT "expiration_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
