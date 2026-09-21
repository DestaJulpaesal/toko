-- Glosir demo data seed
-- Run after supabase-schema.sql in Supabase SQL Editor.
-- Safe to run repeatedly: fixed IDs and ON CONFLICT keep rows stable.

do $$
begin
  if current_setting('app.glossir_seed_environment', true) is distinct from 'development' then
    raise exception 'Demo seed hanya boleh dijalankan dalam environment development.';
  end if;
end $$;

insert into "Category" ("id", "name", "slug", "description") values
  ('cat-glosir', 'Glosir', 'glosir', 'Kebutuhan harian dan produk rumah tangga.'),
  ('cat-bahan-pokok', 'Bahan Pokok', 'bahan-pokok', 'Beras dan kebutuhan pokok keluarga.'),
  ('cat-dapur', 'Kebutuhan Dapur', 'kebutuhan-dapur', 'Produk dapur untuk rumah dan usaha kecil.'),
  ('cat-parsel', 'Parsel', 'parsel', 'Parcel untuk keluarga dan momen spesial.'),
  ('cat-acara', 'Acara', 'acara', 'Paket kebutuhan hajatan dan acara keluarga.'),
  ('cat-minuman', 'Minuman', 'minuman', 'Kopi, teh, dan minuman pilihan.')
on conflict ("id") do update set
  "name" = excluded."name",
  "slug" = excluded."slug",
  "description" = excluded."description",
  "updatedAt" = now();

insert into "Product" ("id", "sku", "name", "slug", "description", "categoryId", "status", "isFeatured", "isParcel", "stockWarning") values
  ('prod-kopi', 'GLS-KOPI-001', 'Kopi Bubuk Premium', 'kopi-bubuk-premium', 'Kopi bubuk pilihan dengan aroma kuat untuk menemani aktivitas harian.', 'cat-glosir', 'ACTIVE', true, false, 5),
  ('prod-beras', 'GLS-BRS-005', 'Beras 5 Kg', 'beras-5-kg', 'Beras pilihan dalam kemasan praktis untuk kebutuhan keluarga.', 'cat-bahan-pokok', 'ACTIVE', true, false, 5),
  ('prod-minyak', 'GLS-MNYK-002', 'Minyak Goreng 2L', 'minyak-goreng-2l', 'Minyak goreng untuk kebutuhan dapur harian.', 'cat-dapur', 'ACTIVE', false, false, 5),
  ('prod-parcel', 'GLS-PRCL-001', 'Parcel Lebaran', 'parcel-lebaran', 'Parcel hangat untuk keluarga dan kerabat.', 'cat-parsel', 'ACTIVE', true, true, 3),
  ('prod-hajatan', 'GLS-HJTN-020', 'Paket Hajatan 20 Porsi', 'paket-hajatan-20-porsi', 'Paket kebutuhan acara yang dapat disesuaikan.', 'cat-acara', 'ACTIVE', false, true, 2),
  ('prod-teh', 'GLS-TEH-040', 'Teh Celup 40 pcs', 'teh-celup-40-pcs', 'Teh celup praktis untuk rumah dan acara.', 'cat-minuman', 'ACTIVE', false, false, 5)
on conflict ("id") do update set
  "sku" = excluded."sku",
  "name" = excluded."name",
  "slug" = excluded."slug",
  "description" = excluded."description",
  "categoryId" = excluded."categoryId",
  "status" = excluded."status",
  "isFeatured" = excluded."isFeatured",
  "isParcel" = excluded."isParcel",
  "stockWarning" = excluded."stockWarning",
  "updatedAt" = now();

insert into "ProductVariant" ("id", "productId", "name", "sku", "barcode", "basePrice", "sellPrice", "stockQty", "unit", "isDefault", "isActive") values
  ('var-kopi-default', 'prod-kopi', 'Kemasan utama', 'GLS-KOPI-001-DEFAULT', '8901234560010', 38000, 48000, 25, 'pack', true, true),
  ('var-beras-default', 'prod-beras', 'Kemasan 5 Kg', 'GLS-BRS-005-DEFAULT', '8901234560027', 62000, 72000, 18, 'karung', true, true),
  ('var-minyak-default', 'prod-minyak', 'Kemasan 2 Liter', 'GLS-MNYK-002-DEFAULT', '8901234560034', 30000, 35000, 9, 'botol', true, true),
  ('var-parcel-default', 'prod-parcel', 'Paket standar', 'GLS-PRCL-001-DEFAULT', '8901234560041', 95000, 120000, 12, 'paket', true, true),
  ('var-hajatan-default', 'prod-hajatan', 'Paket 20 porsi', 'GLS-HJTN-020-DEFAULT', '8901234560058', 480000, 580000, 4, 'paket', true, true),
  ('var-teh-default', 'prod-teh', 'Isi 40 pcs', 'GLS-TEH-040-DEFAULT', '8901234560065', 48000, 59000, 20, 'box', true, true)
on conflict ("id") do update set
  "productId" = excluded."productId",
  "name" = excluded."name",
  "barcode" = excluded."barcode",
  "basePrice" = excluded."basePrice",
  "sellPrice" = excluded."sellPrice",
  "stockQty" = excluded."stockQty",
  "unit" = excluded."unit",
  "isDefault" = excluded."isDefault",
  "isActive" = excluded."isActive",
  "updatedAt" = now();

insert into "StockMovement" ("id", "productId", "variantId", "type", "quantity", "note", "reference") values
  ('move-kopi-opening', 'prod-kopi', 'var-kopi-default', 'IN', 25, 'Stok awal demo', 'SEED-2026-01'),
  ('move-beras-opening', 'prod-beras', 'var-beras-default', 'IN', 18, 'Stok awal demo', 'SEED-2026-01'),
  ('move-minyak-opening', 'prod-minyak', 'var-minyak-default', 'IN', 9, 'Stok awal demo', 'SEED-2026-01'),
  ('move-parcel-opening', 'prod-parcel', 'var-parcel-default', 'IN', 12, 'Stok awal demo', 'SEED-2026-01'),
  ('move-hajatan-opening', 'prod-hajatan', 'var-hajatan-default', 'IN', 4, 'Stok awal demo', 'SEED-2026-01'),
  ('move-teh-opening', 'prod-teh', 'var-teh-default', 'IN', 20, 'Stok awal demo', 'SEED-2026-01')
on conflict ("id") do nothing;

insert into "Parcel" ("id", "name", "slug", "description", "type", "price", "isActive") values
  ('parcel-keluarga', 'Parcel Keluarga', 'parcel-keluarga', 'Pilihan hangat untuk silaturahmi dan berbagi.', 'STANDARD', 120000, true),
  ('parcel-premium', 'Parcel Premium', 'parcel-premium', 'Isi lebih lengkap dengan tampilan siap diberikan.', 'STANDARD', 250000, true),
  ('parcel-hajatan', 'Paket Hajatan', 'paket-hajatan', 'Paket kebutuhan acara sesuai jumlah tamu.', 'CUSTOM', 580000, true)
on conflict ("id") do update set
  "name" = excluded."name",
  "description" = excluded."description",
  "type" = excluded."type",
  "price" = excluded."price",
  "isActive" = excluded."isActive",
  "updatedAt" = now();

insert into "ParcelItem" ("id", "parcelId", "productId", "quantity", "notes") values
  ('parcel-keluarga-kopi', 'parcel-keluarga', 'prod-kopi', 1, 'Produk utama'),
  ('parcel-keluarga-teh', 'parcel-keluarga', 'prod-teh', 1, 'Minuman pendamping'),
  ('parcel-premium-kopi', 'parcel-premium', 'prod-kopi', 2, 'Produk utama'),
  ('parcel-premium-beras', 'parcel-premium', 'prod-beras', 1, 'Kebutuhan pokok'),
  ('parcel-hajatan-beras', 'parcel-hajatan', 'prod-beras', 4, 'Kebutuhan acara'),
  ('parcel-hajatan-minyak', 'parcel-hajatan', 'prod-minyak', 4, 'Kebutuhan dapur')
on conflict ("id") do update set
  "quantity" = excluded."quantity",
  "notes" = excluded."notes";

insert into "PromoCampaign" ("id", "name", "slug", "description", "discountType", "discountValue", "isActive") values
  ('promo-lebaran', 'Promo Lebaran', 'promo-lebaran', 'Diskon untuk parcel keluarga dan kebutuhan dapur.', 'PERCENT', 15, true),
  ('promo-glosir10', 'Glosir Hemat 10', 'glosir10', 'Kode promo demo GLOSIR10.', 'PERCENT', 10, true),
  ('promo-hemat25', 'Hemat 25 Ribu', 'hemat25', 'Kode promo demo HEMAT25.', 'FIXED', 25000, true)
on conflict ("id") do update set
  "name" = excluded."name",
  "description" = excluded."description",
  "discountType" = excluded."discountType",
  "discountValue" = excluded."discountValue",
  "isActive" = excluded."isActive",
  "updatedAt" = now();

insert into "Customer" ("id", "name", "phone", "email", "address", "notes") values
  ('customer-demo-andi', 'Andi Pratama', '081234567890', 'andi@example.com', 'Jl. Melati No. 12', 'Customer demo untuk testing order'),
  ('customer-demo-sari', 'Sari Wulandari', '081298765432', 'sari@example.com', 'Jl. Mawar No. 8', 'Customer demo untuk testing parcel')
on conflict ("id") do update set
  "name" = excluded."name",
  "phone" = excluded."phone",
  "email" = excluded."email",
  "address" = excluded."address",
  "notes" = excluded."notes",
  "updatedAt" = now();

insert into "User" ("id", "name", "email", "passwordHash", "phone", "role", "isActive") values
  ('owner-demo', 'Owner Glosir', 'owner@glosir.com', crypt('123456', gen_salt('bf')), '081234567890', 'OWNER', true)
on conflict ("email") do update set
  "name" = excluded."name",
  "phone" = excluded."phone",
  "role" = excluded."role",
  "isActive" = excluded."isActive",
  "updatedAt" = now();

insert into "SiteProfile" ("id", "headline", "story") values
  ('main', 'Usaha keluarga yang tumbuh dari kebutuhan sehari-hari.', 'Glosir hadir untuk membantu keluarga, pemilik usaha kecil, dan panitia acara mendapatkan kebutuhan penting dengan cara yang lebih praktis.')
on conflict ("id") do update set
  "headline" = excluded."headline",
  "story" = excluded."story",
  "updatedAt" = now();
