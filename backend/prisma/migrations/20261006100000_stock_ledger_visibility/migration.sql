ALTER TABLE "StockMovement" ADD COLUMN "changedById" TEXT;
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");
CREATE INDEX "StockMovement_changedById_createdAt_idx" ON "StockMovement"("changedById", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
