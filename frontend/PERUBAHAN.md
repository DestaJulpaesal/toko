# Perubahan frontend Glosir (30 Sep 2026)

## Diperbaiki
- AdminProfilePage.jsx: dirakit ulang dari commit sehat b8bf19c + fitur "Keluarkan semua perangkat lain" (dari 151e4a8). Rusak karena sisa konflik merge git.
- AdminDashboard.jsx: <div class="admin-main"> nyasar dan <main> ganda dihapus, sekarang pakai AdminShell.
- CashierPage.FASE3-DRAFT.jsx dihapus (tidak dipakai App.jsx).

## Ditambahkan
- src/styles/tokens.css  : design tokens (warna, spasi, radius, font, dark)
- src/styles/ui.css      : penyeragam class lama + komponen g-*  (dimuat paling akhir)
- src/layouts/AdminShell.jsx : kerangka admin tunggal
- src/components/ui/index.jsx: Button, PageHeader, Panel, StatCard, TableWrap, Badge, EmptyState
- scripts/migrate-shell.mjs  : codemod (sudah dijalankan)
- src/main.jsx : urutan CSS tokens -> index -> admin -> ui

## Tahap 2 (lanjutan)
- Semua halaman admin + kasir kini pakai AdminShell (tidak ada lagi <AdminSidebar> manual di pages/).
- AdminCustomersPage, AdminProductsPage, CashierPage: dimigrasi manual (modal dipindah ke dalam shell).
- AdminProductPerformancePage: ditulis ulang. Sebelumnya pakai class Tailwind yang mati + PublicHeader/Footer,
  dan BUG: respons apiFetch tidak di-.json(), jadi data laporan tidak pernah tampil. Sudah diperbaiki.
- ui.css: layout konten vs sidebar disatukan (sebelumnya ada 3 versi + width:100% dengan margin-left 232px
  yang bikin konten meluber ke kanan di desktop). Sekarang mengikuti lebar sidebar (232px / 76px collapsed).

## Tahap 3 (diuji di browser headless dengan API palsu, desktop 1440px & HP 390px)
- BUG BESAR: AdminSidebar memakai ikon <Search> tanpa import -> SEMUA halaman admin crash ("Search is not defined").
  Sudah di-import. Setelah ini 9 halaman diuji: tidak ada error JS, tidak ada overflow horizontal.
- Menu aktif di sidebar: nilai active disamakan dengan label link (Total Kekayaan, Persetujuan Keuangan, Performa Produk).
- Ikon sidebar: Piutang, Performa Produk, Total Kekayaan, Persetujuan Keuangan, Penagihan Wilayah dapat ikon sendiri (tadi angka/ikon dobel).
- ui.css: pengganti class ala Tailwind yang dipakai ~70 ikon di JSX (w-4, h-4, inline, mr-2, text-emerald-600, dst).
  Tanpa ini ikon tampil 24px+ dan merusak baris tombol/pencarian.
- ui.css: kotak pencarian tidak lagi border ganda; .product-table-wrap (ditulis 8x di admin.css) disatukan; baris SKU jadi grid 2 kolom.

## Tahap 4 - Header & footer halaman publik
- PublicHeader tidak punya CSS sama sekali (public-top-header, header-main-bar, nav-link-pill, brand, search, aksi, hamburger)
  sehingga tampil polos seperti teks HTML. Ditulis di src/styles/public.css (dimuat terakhir di main.jsx).
- Header: strip hijau atas, logo + pencarian + Favorit/Keranjang/Order WA, menu pill, sticky. HP: satu baris brand+aksi,
  pencarian di bawahnya, menu jadi dropdown lewat tombol hamburger.
- Footer: kartu dengan 4 highlight, kolom brand + link, baris hak cipta; responsif 4 -> 2 -> 1 kolom.
- Diuji di Chromium (desktop 1440 & HP 390): Beranda, Produk, Promo, FAQ, Keranjang; tanpa error JS & tanpa overflow.

## Belum
- Aturan sidebar lama di admin.css (3 versi) belum dihapus; hasilnya sudah tampil benar di desktop & HP.
- Warna hex lama di admin.css (~1600) belum diganti variabel, jadi mode dark belum sempurna.

## Tidak disertakan: .env (rahasia). Salin .env.example lalu isi sendiri.
Verifikasi: `npm ci && npm run build` sukses; halaman dites di Chromium headless.
