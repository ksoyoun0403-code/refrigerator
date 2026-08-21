-- CreateTable
CREATE TABLE "saved_recipes" (
    "id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "ingredientNames" TEXT[],
    "recipe" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_recipes_fingerprint_key" ON "saved_recipes"("fingerprint");

-- CreateIndex
CREATE INDEX "saved_recipes_createdAt_idx" ON "saved_recipes"("createdAt");
