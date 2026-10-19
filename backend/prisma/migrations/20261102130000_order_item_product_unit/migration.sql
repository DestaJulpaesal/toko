ALTER TABLE "OrderItem" ADD COLUMN "productUnitId" TEXT;

CREATE INDEX "OrderItem_productUnitId_idx" ON "OrderItem"("productUnitId");

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_productUnitId_fkey"
FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
