# Glosir

Platform toko Glosir: POS kasir, katalog publik, pesanan WhatsApp, program parsel,
serta pengelolaan stok dan keuangan. Repo ini berisi backend Express/Prisma dan
frontend React/Vite.

## Tech Stack
- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + Vite
- Auth: JWT + role-based access
- Order online: konfirmasi melalui WhatsApp (bukan payment gateway)
- Database: PostgreSQL/Supabase
- Monorepo-style structure in a single workspace

## Project Structure

```text
Glosir/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/config, middleware, services, routes/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/components, context, pages, services, styles, utils/
│   ├── .env.example
│   └── package.json
├── README.md
└── struktur.md
```

## Core Architecture

### 1. Backend API
- REST API for products, catalog, orders, parcel bundles, finance, and admin.
- Role-based access for owner and cashier.
- One database source for products, stock, sales, and finance.

### 2. Frontend Store
- Public storefront for Glosir and Parcel categories.
- Cart and checkout logic built for direct WhatsApp ordering.
- Admin dashboard for management and reporting.

### 3. WhatsApp Ordering System
- Customers add items to cart.
- User clicks order via WhatsApp.
- Backend generates message template with product list, customer data, and total.
- Order later confirmed into internal system and stock/finance update.

### 4. Finance Sync
- Cashier sales, online order confirmations, and expenditures sync into one finance ledger.
- Owner can review profit, debt, and savings targets.

## Menjalankan secara lokal

1. Gunakan Node.js 20 atau lebih baru dan Docker Desktop.
2. Dari folder utama project, jalankan `docker compose up -d --wait db` untuk
   menyalakan PostgreSQL lokal. Data disimpan di Docker volume `postgres_data`.
3. Jika belum ada, salin `backend/.env.example` menjadi `backend/.env`. Kalau
   file itu sudah ada, ubah `DATABASE_URL` dan `DIRECT_URL` menjadi
   `postgresql://glosir:glosir_local_dev@localhost:5432/glosir_db?schema=public`.
   Isi juga `JWT_SECRET` acak yang kuat dan nilai integrasi lain yang diperlukan.
   Jangan gunakan database produksi untuk tes atau seed.
4. Di terminal backend jalankan `cd backend`, `npm ci`, lalu
   `npx prisma migrate deploy` untuk membuat tabel dari migrasi yang ada.
   Pastikan URL pada `.env` mengarah ke database lokal sebelum migrasi; migrasi
   membuat tabel, tetapi tidak menyalin data dari database lama. Setelah migrasi
   berhasil, jalankan `npm run dev`.
5. Salin `frontend/.env.example` menjadi `frontend/.env`, atur `VITE_API_URL`
   (lokal: `http://127.0.0.1:5000/api`), kemudian jalankan `cd frontend`,
   `npm ci`, dan `npm run dev`.
6. Gambar katalog disimpan di `backend/uploads` dan dilayani langsung oleh
   backend; upload tidak memerlukan Supabase Storage. Folder ini sudah
   dikecualikan dari Git agar foto lokal tidak ikut ter-commit.

## Pemeriksaan

- Backend: `cd backend && npm test`, `npx eslint src`, `npx prisma validate`
- Frontend: `cd frontend && npm test`, `npm run build`
- `npm run test:phase1` dan `npm run preflight` melakukan operasi tulis pada
  database; jalankan hanya terhadap staging khusus, bukan database produksi.

Backend health: `GET /api/health` (liveness ringan) dan
`GET /api/health/deep` (pemeriksaan database).

## Notes

This is the initial project blueprint. It is meant to be expanded into a production-grade commerce system with a real database schema, user roles, API validations, and operational flows.

## Environment and Hosting

Set `VITE_API_URL` in the frontend environment. Use `http://127.0.0.1:5000/api` for local development and the deployed API URL, such as `https://api.example.com/api`, in Vercel/Netlify environment settings.
Set `VITE_STORE_WHATSAPP_NUMBER` to the store's customer-order number in international format (`62...`, without `+`, spaces, or a leading `0`). Keep it separate from `VITE_SUPPORT_WHATSAPP_NUMBER`.

For local development, set `DATABASE_URL` and `DIRECT_URL` to the PostgreSQL
container URL shown in `backend/.env.example`. For a hosted Supabase database,
use its transaction pooler for `DATABASE_URL` and its direct PostgreSQL
connection for `DIRECT_URL`. Never commit real `.env` files or service-role
keys.

Homepage Glosir mengambil kategori, promo aktif, dan produk pilihan melalui satu endpoint `/api/homepage`; cache homepage ditampilkan segera lalu diperbarui dari API. Halaman katalog menampilkan katalog publik dari cache browser lebih dulu, lalu memperbaruinya dari API. Cache hanya menyimpan data publik yang sudah dibersihkan dari harga modal dan kolom internal.

Halaman `/contact-us` menyimpan nama, nomor WhatsApp, dan pesan pengunjung ke tabel `ContactMessage`.
Pada database baru atau database yang sudah memiliki baseline Prisma, jalankan
`npx prisma migrate deploy` dari folder `backend` agar tabel tersedia. Database
lama yang belum memiliki baseline harus dibaseline sesuai kondisi aktual sebelum
migrasi Prisma dijalankan. Peta dan tautan rating memakai alamat toko yang
disediakan pemilik; halaman kontak menampilkan peta interaktif langsung di
halaman. Perbarui alamat di
`frontend/src/pages/ContactPage.jsx` jika lokasi toko berubah.

Untuk menjalankan data demo, gunakan hanya database development dan set sesi
PostgreSQL dengan `set_config('app.glossir_seed_environment', 'development', false)`
atau jalankan `npm run seed:demo` dari folder `backend` setelah `NODE_ENV=development`
dan koneksi database diisi. Seed akan menolak sesi yang tidak memiliki penanda
tersebut. Untuk membuat paket rilis bersih, jalankan
`npm run pack` dari folder utama project. Isi `.env`, `node_modules`, `dist`,
backup JSON, dan uploads tidak dimasukkan.

### Email Gmail

Aktifkan verifikasi/reset password dengan menyalakan verifikasi 2 langkah pada
akun Google, membuka halaman App Passwords, lalu membuat password khusus untuk
aplikasi. Isi hasilnya ke `SMTP_PASS`; jangan gunakan password Gmail utama. Isi
`SMTP_USER`, `EMAIL_FROM`, dan `APP_BASE_URL`, lalu set
`ENABLE_EMAIL_NOTIFICATIONS=true` untuk ringkasan email harian.

### Login Google

Buat OAuth Client ID bertipe **Web application** di Google Cloud Console.
Tambahkan origin frontend lokal/deployment pada Authorized JavaScript origins,
lalu isi nilai yang sama pada `GOOGLE_CLIENT_ID` di backend dan
`VITE_GOOGLE_CLIENT_ID` di frontend. Login Google hanya menerima email yang
sudah terdaftar di Glosir; akun baru tidak otomatis dibuat.

### Catalog Images

### Catalog Images

Owners and admins can upload JPG, PNG, or WebP files up to 5 MB from product,
category, parsel, and event-package forms. Images are stored under
`backend/uploads/catalog/` and served from `/uploads/catalog/...`; no Supabase
Storage bucket or credentials are required. The PostgreSQL Docker volume stores
database records, while these image files live on the backend filesystem. Keep
`backend/uploads/` persistent and backed up. When the backend is hosted behind
a reverse proxy or on a different domain from the frontend, set `PUBLIC_API_URL`
to the public backend origin (for example `https://api.example.com`) so saved
image URLs point to the correct server.

## Implemented Controls

- JWT sessions expire after 8 hours and automatically redirect to login when expired or rejected.
- API requests use `VITE_API_URL`, and backend CORS is restricted by `FRONTEND_URL`.
- Customer loyalty points are stored in `Customer.points`, separate from notes.
- Finance and debt deletion uses soft-delete (`deletedAt`).
- Stock opname, price/stock audit logs, and event package APIs are available to authenticated staff/admin users.
- Admin routes: `/admin/stock-opname` and `/admin/event-packages`; public catalog: `/paket-acara`.
- Owner mengelola akun Owner, Admin, Kasir, dan Manager Parsel di `/admin/accounts`. Undangan karyawan dan reset password akun tim tersedia di halaman tersebut; profil toko tetap dikelola di `/admin/profile`. Kasir tidak ditampilkan sebagai manager parsel.
- Optional nightly WhatsApp recap uses Fonnte when `ENABLE_NIGHTLY_RECAP=true`, `FONNTE_API_KEY`, and `OWNER_WHATSAPP_NUMBER` are configured.
- WhatsApp replies use Fonnte at `POST /api/whatsapp/webhook`. Configure `FONNTE_API_KEY`, `WHATSAPP_WEBHOOK_SECRET` (required as the `x-webhook-secret` header), and the AI provider settings `GLOBOT_CHAT_COMPLETIONS_URL`, `GLOBOT_MODEL`, and `GLOBOT_API_KEY` to enable conversational replies. Set `OWNER_WHATSAPP_NUMBER` for owner-only operational commands and optionally `BRAINWARE_WHATSAPP_NUMBERS` (comma-separated) for team members who can chat with Globot.
- Globot answers general WhatsApp questions from customers and configured brainware. Customers can still use `cek pesanan`, `status`, and `lacak [nomor order]`; owner commands such as `saldo` and `stok` continue to be handled locally and are not sent to the AI provider. Status notifications are sent after admin updates an order through `PATCH /api/orders/:id/status`.
- Parsel now uses `ProductVariant` contents, supports automatic/manual pricing, shows contents publicly, and deducts component stock during POS checkout.

Integrasi WhatsApp, email, Google OAuth, dan penyimpanan gambar memerlukan
kredensial deployment. Periksa `.env.example` untuk nama variabel; jangan
menyimpan nilai rahasia di repo.
## Backup dan keamanan akun

Backup terjadwal aktif melalui `startBackupJob` (default 02:00 Asia/Jakarta) dan
backup manual tersedia untuk OWNER/ADMIN di `/api/backup/run`. Export JSON dibuat
atomik, diberi SHA-256, tidak menyertakan `passwordHash`, dan operasi dibatalkan
sepenuhnya bila salah satu tabel gagal dibaca (tidak ada backup palsu/parsial).
File lokal tetap harus dipindahkan ke storage terenkripsi dengan akses terbatas;
repo ini tidak mengklaim menyediakan off-site backup atau restore otomatis.
Restore belum diaktifkan karena export JSON bukan dump relasional yang aman untuk
ditulis kembali tanpa prosedur migrasi dan verifikasi operator.

Sesi normal dibatasi `SESSION_TIMEOUT_HOURS` (default 8 jam). Password reset
email memakai token satu kali yang kedaluwarsa; perubahan/reset password
mencabut seluruh token lama. `/api/auth/logout-all` mencabut semua perangkat,
sedangkan `/api/auth/logout-others` mempertahankan perangkat saat ini.
