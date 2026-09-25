-- FASE 5: Peringatan Jual Rugi, Kadaluarsa, dan Poin Loyalitas
-- Migration untuk menambahkan fitur:
-- 1. basePrice ke ProductUnit (untuk validasi jual rugi)
-- 2. expiryDate ke ProductUnit (untuk notifikasi kadaluarsa)
-- 3. pointsAwarded dan pointsRedeemed ke Order (untuk tracking poin loyalitas)
-- 4. Tabel LoyaltyRule baru (untuk aturan poin global)

-- 1. Tambah kolom basePrice ke ProductUnit
ALTER TABLE "ProductUnit" ADD COLUMN "basePrice" DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- 2. Tambah kolom expiryDate ke ProductUnit
ALTER TABLE "ProductUnit" ADD COLUMN "expiryDate" TIMESTAMP(3) NULL;

-- 3. Tambah index untuk query notifikasi kadaluarsa
CREATE INDEX "ProductUnit_expiryDate_idx" ON "ProductUnit"("expiryDate");

-- 4. Tambah kolom poin ke Order
ALTER TABLE "Order" ADD COLUMN "pointsAwarded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- 5. Buat tabel LoyaltyRule (aturan poin global)
CREATE TABLE "LoyaltyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pointsPerRp100k" INTEGER NOT NULL DEFAULT 100,
    "minTransactionAmount" DECIMAL(14, 2) NOT NULL DEFAULT 100000,
    "pointsPerRp" DECIMAL(12, 6) NOT NULL DEFAULT 0.001,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 6. Insert default LoyaltyRule
INSERT INTO "LoyaltyRule" ("id", "pointsPerRp100k", "minTransactionAmount", "pointsPerRp", "isActive", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    100,
    100000,
    0.001,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;
