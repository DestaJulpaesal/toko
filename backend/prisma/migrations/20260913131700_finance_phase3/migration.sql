CREATE TABLE "FinanceLoggingStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastLoggedDate" TIMESTAMP(3),
    "totalDaysLogged" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FinanceLoggingStreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceLoggingStreak_userId_key" ON "FinanceLoggingStreak"("userId");

CREATE TABLE "WhatsappFinanceSession" (
    "phoneNumber" TEXT NOT NULL,
    "lastTransactionId" TEXT,
    "pendingCategoryConfirm" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappFinanceSession_pkey" PRIMARY KEY ("phoneNumber")
);

ALTER TABLE "FinanceLoggingStreak"
  ADD CONSTRAINT "FinanceLoggingStreak_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
