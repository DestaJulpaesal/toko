-- Nomor versi token per user. Naik saat password diganti / "keluar dari perangkat lain",
-- sehingga token lama otomatis ditolak. Aman dijalankan ulang (IF NOT EXISTS) dan tidak memutus sesi yang sedang aktif.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
