-- Images are processed in memory for OCR and are no longer persisted.
ALTER TABLE "expiration_items" DROP COLUMN "imageKey";
ALTER TABLE "expiration_scans" DROP COLUMN "imageKey";
