CREATE TABLE "RestockList" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestockList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestockItem" (
    "id" TEXT NOT NULL,
    "restockListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL,
    "stockWarning" INTEGER NOT NULL,
    "suggestedQty" INTEGER NOT NULL DEFAULT 0,
    "requestedQty" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestockItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestockItem_restockListId_variantId_key" ON "RestockItem"("restockListId", "variantId");
CREATE INDEX "RestockList_status_createdAt_idx" ON "RestockList"("status", "createdAt");
CREATE INDEX "RestockItem_categoryName_status_idx" ON "RestockItem"("categoryName", "status");
ALTER TABLE "RestockItem" ADD CONSTRAINT "RestockItem_restockListId_fkey" FOREIGN KEY ("restockListId") REFERENCES "RestockList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestockItem" ADD CONSTRAINT "RestockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestockItem" ADD CONSTRAINT "RestockItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
