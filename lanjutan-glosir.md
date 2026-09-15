# Lanjutan Perbaikan Project Glosir

Konteks: sebagian sudah dikerjakan (sistem notifikasi popup di tengah layar untuk
setiap aksi tambah/edit/hapus sudah dipasang global via `frontend/src/services/api.js`,
`frontend/src/utils/noticeService.js`, `frontend/src/components/NoticeToast.jsx`,
dan 9 halaman admin dengan fitur hapus massal sudah dirapikan). Tolong lanjutkan
pekerjaan berikut:

## 1. Fix bug backend (belum ada try/catch)

File `backend/src/routes/auditLogRoutes.js` dan `backend/src/routes/eventPackageRoutes.js`
tidak punya try/catch di route handler-nya. Backend pakai Express 4 (bukan versi 5),
jadi error yang dilempar di dalam async function TIDAK otomatis ditangkap oleh
global error handler di `app.js` — akibatnya kalau ada error database, request
akan nge-hang/loading terus alih-alih mengembalikan pesan error.

Tolong:
- Tambahkan try/catch di setiap route handler di kedua file tersebut.
- Ikuti pola penanganan error yang sudah dipakai di file route lain yang sudah
  benar, misalnya `backend/src/routes/productRoutes.js` (format response error:
  `res.status(...).json({ success: false, message: '...' })`).

## 2. Verifikasi ulang `AdminContentPage.jsx`

Sebelumnya ditemukan typo di `AdminCategoriesPage.jsx` di mana `silentNotify: true`
salah ditempel ke fungsi delete satu-item, padahal harusnya ditempel ke fungsi
bulk-delete (`Promise.allSettled(...)`). Kemungkinan bug yang sama terjadi di
`AdminContentPage.jsx` karena polanya identik (sama-sama pakai parameter `${id}`
untuk endpoint single-delete maupun bulk-delete).

Tolong cek baris `method: 'DELETE'` di file itu, pastikan:
- Fungsi delete SATU item -> TIDAK pakai `silentNotify: true` (biar tetap
  muncul popup otomatis).
- Fungsi bulk-delete (di dalam `Promise.allSettled`) -> HARUS pakai
  `silentNotify: true`, karena halaman itu sudah manggil `showNotice(...)`
  sendiri untuk menampilkan 1 ringkasan.

## 3. Audit fungsional semua halaman (bukan cuma baca kode)

Jalankan backend (`npm run dev` di folder `backend`) dan frontend
(`npm run dev` di folder `frontend`), pastikan `.env` backend sudah terisi
`DATABASE_URL` yang valid. Lalu cek satu per satu:
- Apakah setiap halaman admin (produk, kategori, pelanggan, promo, parsel,
  finance, dsb) berhasil load data dari database (bukan error/kosong).
- Apakah aksi tambah, edit, hapus di tiap halaman benar-benar tersimpan ke
  database (refresh halaman, data harus tetap ada/berubah).
- Apakah ada halaman yang error di console browser (network error 404/500,
  atau error React di console).
- Catat semua halaman/fitur yang bermasalah beserta pesan error-nya.

## 4. Rekomendasi UX untuk pengguna awam (target: orang tua, gaptek)

Aplikasi ini nantinya dipakai orang tua saya yang tidak paham teknologi.
Tolong beri rekomendasi (dan implementasikan yang paling penting) untuk
memudahkan penggunaan, misalnya:
- Ukuran font dan tombol diperbesar, kontras warna dijelaskan lebih tegas.
- Alur kasir/checkout dibuat seminim mungkin langkah (kurangi klik).
- Konfirmasi yang jelas (bukan cuma teks kecil) sebelum aksi penting seperti
  hapus data atau checkout.
- Dashboard admin versi "simpel" yang hanya menampilkan menu paling sering
  dipakai sehari-hari (tidak menampilkan semua 20+ menu admin sekaligus).
- Pesan error dalam bahasa yang mudah dimengerti (bukan istilah teknis).
- Pertimbangkan tombol/menu berukuran besar dengan ikon jelas, bukan hanya teks.

Beri saya daftar rekomendasi lengkap, lalu implementasikan yang menurutmu
berdampak paling besar untuk kemudahan pemakaian.

## 5. Cek menyeluruh potensi masalah lain

Selain 4 poin di atas, tolong telusuri juga apakah ada halaman, endpoint,
atau fitur lain di project ini yang:
- Belum lengkap/setengah jadi.
- Berpotensi error saat dipakai di kondisi nyata (misal race condition,
  validasi input yang kurang, dsb).
- Tidak konsisten dengan pola yang sudah ada di bagian lain aplikasi.
