CREATE TABLE "FinanceQuickTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2),
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "icon" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceQuickTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinanceQuickTemplate"
  ADD CONSTRAINT "FinanceQuickTemplate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceQuickTemplate"
  ADD CONSTRAINT "FinanceQuickTemplate_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceQuickTemplate"
  ADD CONSTRAINT "FinanceQuickTemplate_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "FinanceQuickTemplate_userId_createdAt_idx" ON "FinanceQuickTemplate"("userId", "createdAt");
