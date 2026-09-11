# Prompt Perbaikan Project "Glosir" untuk GitHub Copilot

Copy-paste seluruh isi file ini ke Copilot Chat (atau Copilot agent mode) di dalam root folder project `Glosir/`. Kerjakan berurutan sesuai prioritas — jangan loncat ke prioritas 3 sebelum prioritas 1 & 2 selesai, karena prioritas 1 itu yang bikin website gagal total begitu di-hosting.

Tech stack project: Node.js + Express + Prisma (PostgreSQL/Supabase) di `backend/`, React + Vite di `frontend/`.

---

## PRIORITAS 1 — WAJIB SEBELUM HOSTING (blocker)

### 1.1 Ganti semua hardcoded `http://localhost:5000` di frontend jadi pakai env variable

**Masalah:** Ada 23 file di `frontend/src/` yang manggil API langsung ke `http://localhost:5000/api/...` secara hardcoded, padahal sudah ada `VITE_API_URL` di `.env` yang gak pernah dipakai sama sekali. Akibatnya begitu di-deploy ke hosting manapun, semua fitur (login, produk, kasir, keuangan, parsel, dll) bakal gagal total karena browser user nyoba akses `localhost` di komputer mereka sendiri, bukan server production.

**Perbaikan yang diminta:**
1. Buat satu file util terpusat, misal `frontend/src/services/api.js`, yang export base URL dari `import.meta.env.VITE_API_URL` (dengan fallback ke `http://localhost:5000/api` untuk dev lokal).
2. Idealnya buat helper `apiFetch(path, options)` yang otomatis menempelkan base URL ini, supaya ke depan gak perlu tulis full URL lagi di setiap file.
3. Cari SEMUA occurrence string `http://localhost:5000` di folder `frontend/src/` (pakai `grep -rn "localhost:5000" frontend/src/` untuk verifikasi) dan ganti semuanya untuk pakai helper/base URL tadi. File-file yang kena termasuk (tapi jangan cuma cek daftar ini, pastikan grep dan sisir semua):
   - `src/components/DebtModal.jsx`
   - `src/pages/ProfilePage.jsx`
   - `src/pages/AdminCategoriesPage.jsx`
   - `src/pages/AdminParcelsPage.jsx`
   - `src/pages/AdminProfilePage.jsx`
   - `src/pages/AdminFinancePage.jsx`
   - `src/pages/AdminCustomersPage.jsx`
   - `src/pages/PublicInfoPage.jsx`
   - `src/pages/ProductPage.jsx`
   - `src/pages/AdminPromosPage.jsx`
   - `src/pages/AdminParcelParticipantsPage.jsx`
   - `src/pages/LoginPage.jsx`
   - `src/pages/ParcelPage.jsx`
   - `src/pages/AdminDashboard.jsx`
   - `src/pages/AdminParcelProgramsPage.jsx`
   - `src/pages/ParcelCollectionPage.jsx`
   - `src/pages/CashierPage.jsx`
   - `src/pages/CashierHistoryPage.jsx`
   - `src/pages/HomePage.jsx`
   - `src/pages/PromoPage.jsx`
   - `src/pages/AdminProductsPage.jsx`
   - `src/pages/AdminParcelRegionsPage.jsx`
   - `src/pages/AdminContentPage.jsx`
4. Setelah selesai, jalankan `grep -rn "localhost:5000" frontend/src/` lagi dan pastikan hasilnya kosong (0 baris).
5. Update `frontend/.env` dan `.env.example` supaya `VITE_API_URL` diisi placeholder yang jelas untuk production (misal `https://api.domainkamu.com/api`), dan pastikan dokumentasikan di README bahwa env ini WAJIB di-set beda antara dev dan production di hosting (Vercel/Netlify/dll env variable settings).

### 1.2 Tambahkan proteksi login (JWT auth) di endpoint backend yang sekarang terbuka bebas

**Masalah:** Route-route berikut di `backend/src/routes/` **tidak punya middleware `authenticateToken`/`requireRole` sama sekali** di method POST/PATCH/DELETE-nya, artinya siapapun yang tau URL API bisa mengubah/menghapus data tanpa login:
- `financeRoutes.js` (POST `/`, PATCH `/:id`, DELETE `/:id`)
- `categoryRoutes.js` (POST `/`, PATCH `/:id`, DELETE `/:id`)
- `debtRoutes.js` (POST `/`, PATCH `/:id`, DELETE `/:id`)
- `promoRoutes.js` (POST `/`, PATCH `/:id`, DELETE `/:id`)
- `siteContentRoutes.js` (POST `/`, PATCH `/:id`, DELETE `/:id`)
- `siteProfileRoutes.js` (PATCH `/`)
- `parcelRoutes.js` (POST `/`, POST `/custom`, PATCH `/:id`, DELETE `/:id`)
- `parcelProgramRoutes.js` (POST `/`, PATCH `/:id`, DELETE `/:id`)
- `orderRoutes.js` (POST `/checkout` — ini boleh dipertimbangkan tetap publik kalau memang dipakai flow checkout customer tanpa login, tapi GET `/` dan GET `/:id` sebaiknya dibatasi hanya untuk staff)

**Perbaikan yang diminta:**
1. Pakai pola yang sudah ada dan konsisten di `productRoutes.js` (`authenticateToken, requireRole('OWNER', 'ADMIN')`) dan middleware yang sudah ada di `backend/src/middleware/auth.js` (`authenticateToken`, `requireRole`, `optionalAuth`) — jangan bikin sistem auth baru.
2. Untuk semua route di atas: method GET (baca data) boleh tetap pakai `authenticateToken` biasa (siapapun yang login, minimal Kasir, boleh lihat) KECUALI data Keuangan (`financeRoutes.js`) yang menurut blueprint project ini HARUS role `OWNER` saja (Kasir tidak boleh lihat laporan keuangan) — jadi `financeRoutes.js` GET & semua write method wajib `authenticateToken, requireRole('OWNER')`.
3. Untuk method POST/PATCH/DELETE di `categoryRoutes.js`, `debtRoutes.js`, `promoRoutes.js`, `siteContentRoutes.js`, `siteProfileRoutes.js`, `parcelRoutes.js`, `parcelProgramRoutes.js`: tambahkan `authenticateToken, requireRole('OWNER', 'ADMIN')`.
4. Setelah selesai, update juga fetch call di frontend untuk route-route ini supaya menyertakan header `Authorization: Bearer <token>` dari `localStorage.getItem('glosir_token')` — cek satu-satu apakah sudah ada, karena sebagian file frontend (misal `AdminFinancePage.jsx`, `AdminCategoriesPage.jsx`, `AdminPromosPage.jsx`, `AdminContentPage.jsx`, `AdminParcelsPage.jsx`) saat ini TIDAK mengirim header Authorization sama sekali di request POST/PATCH/DELETE-nya, jadi begitu backend-nya diproteksi, request itu akan mulai gagal 401 kalau tidak dibenerin bareng.
5. Test manual setelah perubahan: pastikan request tanpa token ke endpoint-endpoint itu balikin `401`, dan dengan token role OWNER/ADMIN yang valid tetap berhasil.

### 1.3 Perbaiki konfigurasi Prisma supaya bisa jalan di server Linux (bukan cuma Windows)

**Masalah:** `backend/prisma/schema.prisma` generator block-nya cuma:
```prisma
generator client {
  provider = "prisma-client-js"
}
```
Tanpa `binaryTargets`, Prisma Client cuma generate query engine untuk OS development (Windows). Kalau di-hosting di server Linux (Railway, Render, VPS Ubuntu, dll — yang paling umum), akan muncul error "could not locate the Query Engine for runtime debian-openssl-3.0.x".

**Perbaikan yang diminta:**
1. Update `backend/prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]
}
```
   (tambahkan `linux-musl-openssl-3.0.x` juga untuk jaga-jaga kalau hosting-nya pakai image Alpine/Docker musl-based, misal Railway kadang pakai ini.)
2. Jalankan ulang `npx prisma generate` setelah update.
3. Tambahkan step `npx prisma generate` ke dalam script `postinstall` di `backend/package.json` supaya otomatis ke-generate ulang setiap kali `npm install` dijalankan di server hosting:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

---

## PRIORITAS 2 — BUG RELIABILITAS (biar gak nge-hang / rawan error di production)

### 2.1 Tambahkan timeout & abort ke handler bulk-add produk di frontend

**Masalah:** Fungsi `handleAddBulkProducts` di `frontend/src/pages/AdminProductsPage.jsx` (dipanggil dari `BulkProductModal.jsx` via prop `onAddProducts`) melakukan `fetch` ke `/api/products/bulk` TANPA `AbortController`/timeout sama sekali, beda dengan form edit produk tunggal (`submitForm`) yang sudah punya timeout 15 detik. Kalau koneksi database lambat atau nyangkut, request ini bisa hang tanpa batas waktu dan tanpa pesan error ke user.

**Perbaikan yang diminta:**
1. Tambahkan `AbortController` dengan timeout (pakai 20-30 detik karena ini bulk insert banyak item, butuh waktu lebih dari single edit) di `handleAddBulkProducts`, dengan pola yang sama seperti di `submitForm`.
2. Tampilkan pesan loading yang jelas ke user selama proses bulk-add berjalan (saat ini `BulkProductModal.jsx` langsung `onClose()` begitu tombol simpan diklik, TANPA menunggu hasil dari `onAddProducts` — ini membuat modal tertutup padahal proses simpan masih berjalan di background, dan user tidak tahu progresnya). Ubah supaya modal menunggu (`await onAddProducts(...)`) dan menampilkan state loading/disable tombol selama proses berlangsung, baru `onClose()` setelah selesai (baik sukses maupun gagal).
3. Tambahkan pesan error yang jelas ke `notice` kalau request timeout/gagal, sama seperti pola di `submitForm`.

### 2.2 Perbaiki konfigurasi koneksi database Prisma + Supabase Pooler

**Masalah:** File `.env` backend punya `DATABASE_URL` dan `DIRECT_URL` (pola standar Supabase+Prisma+PgBouncer), tapi `backend/prisma/schema.prisma` di block `datasource db` **tidak mendefinisikan `directUrl`** sama sekali — jadi `DIRECT_URL` yang ada di `.env` sekarang jadi mubazir/tidak kepake. Ini berpotensi jadi penyebab kasus "loading nyangkut lama banget pas save" yang pernah dialami, terutama kalau ada banyak koneksi/transaksi dibuka bersamaan (misal abis bulk-insert banyak produk) dan pool koneksi ke Supabase jadi penuh/nyangkut.

**Perbaikan yang diminta:**
1. Update `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
2. Cek ke dashboard Supabase project ini (Project Settings → Database → Connection Pooling) untuk konfirmasi: `DATABASE_URL` sebaiknya pakai **Transaction pooler** (biasanya port `6543`) dan `DIRECT_URL` pakai **koneksi langsung/non-pooled** (port `5432`, host tanpa `pooler` di namanya, format `db.<project-ref>.supabase.co`). Update isi `.env` sesuai anjuran resmi Supabase untuk Prisma kalau formatnya belum sesuai (saat ini kedua variable itu sama-sama mengarah ke pooler port 5432, yang bukan konfigurasi yang direkomendasikan).
3. Di `backend/src/config/db.js`, tambahkan graceful shutdown supaya koneksi Prisma ditutup rapi saat proses backend berhenti/restart, biar gak ninggalin koneksi nyangkut:
```js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
```
4. Tambahkan logging query yang lebih informatif sementara untuk debugging (opsional, bisa dihapus nanti): `new PrismaClient({ log: ['warn', 'error'] })`, supaya kalau ada query yang lambat/gagal, ada jejak di terminal backend.

### 2.3 Hilangkan default fallback JWT secret yang tidak aman

**Masalah:** `backend/src/middleware/auth.js` punya fallback: `process.env.JWT_SECRET || 'glosir-dev-secret'`. Kalau env `JWT_SECRET` lupa di-set di server hosting, aplikasi tetap jalan diam-diam pakai secret yang predictable/publik (ada di kode ini), yang bikin token JWT gampang dipalsukan.

**Perbaikan yang diminta:**
1. Hapus fallback default itu. Ganti jadi validasi wajib saat startup: kalau `process.env.JWT_SECRET` tidak ada, `server.js` harus langsung `throw`/`process.exit(1)` dengan pesan error yang jelas ("JWT_SECRET wajib di-set di environment variable"), supaya ketauan dari awal kalau env belum di-set di hosting, bukan diam-diam pakai secret yang lemah.

---

## PRIORITAS 3 — BERSIH-BERSIH (opsional, tapi sebaiknya sekalian)

1. **Hapus dependency `axios` yang tidak pernah dipakai** dari `frontend/package.json` (semua fetch di project ini pakai native `fetch`, bukan axios) — atau sebaliknya, kalau mau konsisten pakai axios untuk semua, migrasikan semua `fetch(...)` ke axios instance yang sudah dikonfigurasi base URL-nya (opsional, pilih salah satu, jangan dua-duanya).
2. **Hapus file `frontend/src/services/supabaseClient.js`** kalau memang tidak dipakai di manapun (cek dulu dengan `grep -rn "supabaseClient" frontend/src/` untuk pastikan), atau kalau memang rencananya mau dipakai untuk fitur lain nanti, tambahkan komentar penjelasan kenapa file ini ada tapi belum dipakai.
3. **Kurangi ukuran bundle JS frontend** (build sekarang 894 KB, Vite kasih warning "chunk size limit"). Terapkan code-splitting dengan `React.lazy()` + `Suspense` untuk halaman-halaman admin (`AdminDashboard`, `AdminProductsPage`, `AdminFinancePage`, dst) di routing `App.jsx`, supaya halaman publik (`HomePage`, `ProductPage`) tidak perlu load semua kode admin sekaligus.
4. **Update `README.md`** supaya sesuai dengan struktur folder project yang sebenarnya sekarang (saat ini README masih menyebutkan struktur lama seperti `controllers/`, `services/whatsappService.js`, dll yang sudah tidak ada di kode).
5. Tambahkan file `backend/.env.example` dan `frontend/.env.example` yang sudah include semua variable yang benar-benar dipakai project saat ini (`DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` belum ada di `.env.example` backend, padahal dipakai di `.env` asli).

---

## Setelah semua perbaikan di atas selesai

1. Jalankan `npm run build` di folder `frontend/` dan pastikan build tetap sukses tanpa error baru.
2. Jalankan backend (`npm run dev` di folder `backend/`) dan test manual: login, tambah produk satuan, tambah produk bulk, edit produk, hapus produk, buka halaman Keuangan, Kategori, Promo — pastikan semua masih berfungsi dan endpoint yang sekarang diproteksi tetap bisa diakses dari UI (karena sudah kirim token).
3. Baru setelah semua di atas beres dan sudah ditest jalan normal di lokal, boleh lanjut ke proses hosting/deploy.
