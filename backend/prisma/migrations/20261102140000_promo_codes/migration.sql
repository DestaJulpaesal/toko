ALTER TABLE "PromoCampaign"
ADD COLUMN "code" TEXT,
ADD COLUMN "minPurchase" DECIMAL(12, 2),
ADD COLUMN "maxDiscount" DECIMAL(12, 2),
ADD COLUMN "usageLimit" INTEGER,
ADD COLUMN "usedCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "PromoCampaign_code_key" ON "PromoCampaign"("code");

CREATE INDEX "PromoCampaign_isActive_startsAt_endsAt_idx"
ON "PromoCampaign"("isActive", "startsAt", "endsAt");
