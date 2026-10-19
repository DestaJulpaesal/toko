CREATE INDEX IF NOT EXISTS "Customer_phone_idx"
ON "Customer"("phone");

CREATE INDEX IF NOT EXISTS "Product_status_isFlashSale_idx"
ON "Product"("status", "isFlashSale");
CREATE INDEX IF NOT EXISTS "Product_status_isBestseller_idx"
ON "Product"("status", "isBestseller");
CREATE INDEX IF NOT EXISTS "Product_status_isRecommended_idx"
ON "Product"("status", "isRecommended");

CREATE INDEX IF NOT EXISTS "StockMovement_reference_idx"
ON "StockMovement"("reference");

CREATE INDEX IF NOT EXISTS "Order_type_status_createdAt_idx"
ON "Order"("type", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx"
ON "Order"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"
ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx"
ON "OrderItem"("variantId");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_deletedAt_createdAt_type_idx"
ON "FinanceTransaction"("deletedAt", "createdAt", "type");
CREATE INDEX IF NOT EXISTS "FinanceTransaction_orderId_idx"
ON "FinanceTransaction"("orderId");
