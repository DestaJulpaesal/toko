# Audit Admin dan Rekomendasi UX Glosir

Tanggal audit: 14 September 2026

## Hasil audit manual

Seluruh 24 route admin berikut berhasil dibuka menggunakan sesi admin yang aktif:

- Dashboard sederhana dan dashboard lengkap
- Produk, kategori, pelanggan, parsel, promo, profil, dan konten
- Keuangan, keuangan pribadi, piutang, laporan, kalender, net worth, approval, dan audit
- Peserta parsel, program parsel, wilayah parsel, koleksi parsel
- Stock opname, restok, dan paket acara

### Temuan dan perbaikan

1. Polling reminder dan beberapa data finance sebelumnya mengembalikan `404`.
   Penyebabnya adalah route generik finance `/:id` dipasang sebelum route
   `categories`, `accounts`, `tags`, `reminders`, dan `approvals`.
   Urutan route sudah diperbaiki di `backend/src/app.js`.
2. Setelah perbaikan, endpoint berikut tervalidasi mengembalikan `200`:
   - `/api/finance/categories`
   - `/api/finance/accounts`
   - `/api/finance/tags`
   - `/api/finance/reminders`
   - `/api/finance/approvals`
3. Tidak ditemukan error React atau request `4xx/5xx` saat seluruh route admin
   dibuka ulang dengan sesi aktif.
4. Console masih menampilkan dua warning React Router tentang kesiapan v7.
   Warning ini tidak memblokir halaman, tetapi sebaiknya ditangani saat upgrade
   React Router berikutnya.

## Verifikasi CRUD dan persistensi

Semua pembacaan admin memakai endpoint backend yang mengambil data PostgreSQL.
Fallback data lokal pada route konten publik sudah dihapus; konten sekarang selalu
dibaca, dibuat, diubah, dan dihapus melalui Prisma/database. Seed konten bawaan
hanya dijalankan sekali untuk mengisi tipe konten yang belum ada di database.

Uji CRUD aman dilakukan menggunakan data sementara langsung di database:

1. Produk: create, update, reread, delete berhasil.
2. Kategori: create, update, reread, delete berhasil.
3. Pelanggan: create, update, reread, delete berhasil.
4. Promo: create, update, reread, delete berhasil.
5. Konten: create, update, reread, delete berhasil.
6. Target tabungan: create, update, reread, archive berhasil.
7. Akun keuangan: create, update, reread, archive berhasil.
8. Program parcel: create, update, reread, deactivate berhasil.
9. Paket acara: create, update, reread, deactivate berhasil.
10. Stock opname: create dan reread berhasil dengan jumlah fisik sama dengan
    stok sistem, lalu catatan dihapus tanpa mengubah stok akhir.
11. Daftar restok: create, update item, reread, dan close berhasil.
12. Transaksi keuangan: create, update, reread, dan soft-delete berhasil.

Semua data sementara sudah dibersihkan atau diarsipkan setelah pengujian.

Modul yang tidak memiliki operasi lengkap di backend, seperti wilayah parcel
yang tidak menyediakan delete permanen, diuji sesuai operasi yang memang
disediakan: create, update, dan nonaktifkan.

## Pemeriksaan fitur yang belum lengkap atau berisiko

- Dashboard detail menampilkan status memuat lebih lama daripada dashboard
  sederhana karena mengambil beberapa laporan secara paralel. Beri waktu sampai
  semua request selesai sebelum menyimpulkan data kosong.
- Warning React Router perlu dirapikan ketika dependensi dinaikkan.
- Endpoint async lama yang tidak berkaitan langsung dengan audit sebaiknya
  tetap diberi `try/catch` secara bertahap agar error database tidak membuat
  request menggantung.
- Aksi hapus dan checkout harus selalu memakai konfirmasi yang terlihat jelas;
  jangan mengandalkan teks kecil atau notifikasi yang cepat hilang.
- Pengujian transaksi penjualan, pembayaran piutang, dan perubahan stok
  sebaiknya dilakukan di database staging sebelum digunakan sebagai regression
  test otomatis.

## Rekomendasi UX untuk pengguna awam

### Prioritas tinggi

1. Pertahankan dashboard sederhana sebagai halaman awal owner: omzet hari ini,
   stok menipis, piutang jatuh tempo, dan pesanan baru.
2. Gunakan tombol minimal 44px, teks label yang jelas, dan warna status yang
   konsisten: hijau aman, kuning menipis/perlu perhatian, merah habis/gagal.
3. Tampilkan konfirmasi besar sebelum hapus data, menyelesaikan pembayaran,
   checkout, atau mengubah stok.
4. Tampilkan pesan bahasa sehari-hari, misalnya “Data belum tersimpan, coba
   periksa koneksi internet” daripada stack trace atau istilah teknis.
5. Sediakan pencarian dan filter di halaman yang datanya panjang; pertahankan
   nilai filter saat pengguna kembali dari detail.

### Prioritas menengah

1. Tambahkan tooltip atau panduan singkat pada ikon saja, tetapi tetap sertakan
   teks pada aksi penting.
2. Gunakan format Rupiah dan tanggal lokal pada semua ringkasan keuangan.
3. Setelah simpan, tampilkan ringkasan perubahan dan tombol “Lihat data”.
4. Untuk kasir, fokuskan alur pada pilih barang → jumlah → bayar → cetak struk,
   tanpa membuka menu admin.
5. Sediakan shortcut “Tambah transaksi cepat” dari header dashboard.

## Keputusan Arsitektur

Folder `backend/src/controllers/`, `frontend/src/hooks/`, dan
`frontend/src/features/` sengaja belum diisi. Saat ini struktur yang paling
rapi untuk ukuran aplikasi ini adalah:

```text
Route -> validasi + autentikasi -> Prisma/service khusus -> database
Page -> komponen/context -> api service -> API
```

Memaksa semua route dipindahkan ke controller sekarang hanya akan menambah
file dan lapisan tanpa mengurangi kompleksitas. Controller baru layak dibuat
ketika satu domain sudah memiliki banyak handler atau perlu diuji terpisah.

Rencana pemakaian folder ke depan:

- `controllers/`: dipakai bertahap untuk domain besar seperti order, finance,
  dan parcel jika route mulai sulit dirawat; satu migrasi domain per tahap.
- `hooks/`: dipakai untuk logika UI yang berulang, misalnya `useApiList`,
  `useDebouncedSearch`, dan `usePersistedTableFilters`.
- `features/`: dipakai bila satu fitur sudah memiliki page, komponen, service,
  dan test sendiri. Kandidat pertama adalah `features/cashier` dan
  `features/finance`.

Untuk sekarang, folder kosong tersebut tidak perlu dihapus atau dipaksa diisi.
Yang penting adalah aturan kontribusi: logika database tidak masuk komponen
React, dan logika UI berulang baru dipindahkan ke hook setelah muncul di dua
atau lebih halaman.

## Implementasi Prioritas September 2026

Sudah diterapkan:

1. Dashboard owner sederhana menjadi halaman awal dengan empat ringkasan utama
   dan empat tombol kerja besar: Kasir, Catat Uang Keluar, Cek Stok, dan
   Kelola Parsel.
2. Ukuran teks dashboard tetap dapat diperbesar dari sidebar dan tombol utama
   memenuhi target sentuh yang lebih nyaman.
3. Prisma memakai pool koneksi kecil yang sesuai untuk Supabase pooler.
4. Backup bootstrap saat server baru menyala dibuat opt-in melalui
   `ENABLE_BOOTSTRAP_BACKUP=true`, agar server tidak langsung menghabiskan
   koneksi database. Backup manual dan backup terjadwal tetap tersedia.
5. Preflight operasional backend berhasil 4/4: koneksi database, transaksi
   tunai, pemotongan stok, dan pencatatan piutang.

Tahap berikutnya sebelum dipakai di toko:

1. Uji langsung alur kasir dengan scanner dan printer yang akan dipakai.
2. Buat akun owner dan kasir non-demo, lalu lakukan uji pemulihan password/
   pergantian perangkat.
3. Uji tutup kas harian dan rekonsiliasi dengan uang fisik.
4. Tambahkan mode “Bantuan” berisi langkah bergambar untuk kasir baru.
5. Lakukan uji penerimaan bersama orang tua menggunakan tugas nyata, bukan
   hanya uji teknis halaman.

### Prioritas lanjutan

1. Tambahkan mode ukuran teks besar untuk layar kasir dan pengguna lanjut usia.
2. Tambahkan backup/export berkala dan indikator kapan backup terakhir dibuat.
3. Buat regression test terotomasi untuk CRUD kategori, produk, restok, dan
   transaksi keuangan pada database staging.
