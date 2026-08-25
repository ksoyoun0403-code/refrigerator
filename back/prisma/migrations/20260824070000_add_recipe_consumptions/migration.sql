CREATE TABLE "recipe_consumptions" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(64) NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_consumptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_consumptions_userId_idempotencyKey_key"
ON "recipe_consumptions"("userId", "idempotencyKey");

CREATE INDEX "recipe_consumptions_userId_createdAt_idx"
ON "recipe_consumptions"("userId", "createdAt");

ALTER TABLE "recipe_consumptions"
ADD CONSTRAINT "recipe_consumptions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
