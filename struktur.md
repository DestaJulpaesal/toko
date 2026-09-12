# BLUEPRINT SISTEM
## Digitalisasi Usaha Glosir, Parsel, E-Commerce & Keuangan Keluarga

*Dokumen rancangan — September 2026; implementation status is noted on delivered modules.*
*September 2026*

---

## 1. Ringkasan Sistem

Sistem ini adalah **satu website terpadu** yang menggabungkan:

1. **Kasir (POS)** — untuk transaksi offline di toko, khusus lini **Glosir**.
2. **E-Commerce** — etalase online untuk pelanggan luar, terdiri dari **2 kategori: Glosir & Parsel**, dengan pemesanan yang diarahkan/diselesaikan lewat **WhatsApp**.
3. **Keuangan Keluarga** — pencatatan uang masuk-keluar yang **otomatis terhubung** ke transaksi Glosir & Parsel, plus pengeluaran, tabungan bertujuan, dan utang-piutang.

Ketiganya memakai **satu basis data dan satu login**, dengan hak akses berbeda antara **Pemilik (Orang Tua)** dan **Kasir/Karyawan**.

**Prinsip Desain**

- Satu sistem, bukan aplikasi terpisah-pisah — data barang, transaksi kasir, transaksi online, dan keuangan semua saling terhubung.
- Sistem memberi saran otomatis (restock, harga, promo, alokasi keuangan), tetapi keputusan akhir selalu bisa diubah manual oleh pengguna.
- Fitur kontrol (stok opname, deteksi jual rugi, log audit) dibangun sejak awal — supaya data akurat dan uang tidak bocor tanpa disadari.
- Berbasis web, responsif, bisa diakses dari HP maupun laptop, kapan saja, dari mana saja.
- Skala besar dari awal: struktur database dirancang supaya gampang ditambah fitur/modul baru ke depannya, bukan sistem yang mentok kalau berkembang.

---

## 2. Struktur Umum & Arsitektur

Sistem terbagi menjadi **4 area besar**: Kasir, E-Commerce, Keuangan, dan Panel Admin/Dashboard — dengan data barang & stok sebagai fondasi yang dipakai bersama oleh Kasir maupun E-Commerce.

| Komponen | Deskripsi |
| --- | --- |
| Login & Role | **Owner (Orang Tua)**: akses penuh semua modul, laporan, dan keuangan. **Kasir/Karyawan**: akses terbatas — input transaksi kasir & update stok, tanpa ubah harga/lihat laporan keuangan. |
| Dashboard Utama | Ringkasan omzet hari ini (gabungan kasir + online), stok menipis, pesanan parsel yang harus disiapkan, pesanan online yang perlu diproses, piutang jatuh tempo. |
| Data Barang (pusat) | Satu sumber data barang & stok yang dipakai bersama oleh Kasir dan E-Commerce, supaya stok selalu sinkron antara penjualan offline dan online. |
| Kasir (POS) | Transaksi tatap muka di toko — khusus lini Glosir (eceran/grosir langsung). |
| E-Commerce | Etalase online untuk pelanggan luar — 2 kategori: **Glosir** & **Parsel**, checkout diarahkan ke WhatsApp. |
| Modul Parsel | Perakitan & penjualan paket parsel, termasuk pre-order, dipakai baik dari toko maupun dari pesanan online. |
| Modul Keuangan | Pemasukan (otomatis dari Kasir + E-Commerce), pengeluaran, tabungan bertujuan, utang-piutang. |

**Alur data:** Transaksi Kasir maupun Pesanan E-Commerce → mengurangi stok barang yang sama → mencatat pemasukan yang sama → masuk ke Modul Keuangan secara otomatis. Jadi Orang Tua tidak perlu input pemasukan dua kali.

---

## 3. Modul Glosir (berlaku untuk Kasir & E-Commerce)

### 3.1 Data Barang & Sistem Satuan

Karena barang glosir dijual dalam berbagai satuan dan sebagian bisa pecahan (eceran), setiap barang memiliki **satuan dasar** (satuan terkecil untuk menyimpan stok) dan **satu atau lebih satuan jual**.

| Barang | Satuan Dasar | Satuan Jual Tersedia | Konversi |
| --- | --- | --- | --- |
| Rokok Merek A (boleh eceran) | batang | batang, bungkus, slop | 1 bungkus = 12 batang |
| Rokok Merek B (tidak eceran) | batang | bungkus, slop | 1 slop = 10 bungkus |
| Terigu | gram | kg, ½ kg, ¼ kg | 1 kg = 1000 gram |
| Kopi Bubuk Curah | gram | gantung, ½ gantung, kg | 1 gantung = 250 gram |
| Kopi Sachet | sachet | sachet (ecer), renceng | 1 renceng = 10 sachet |

*Harga tiap satuan jual diinput manual per barang — bukan hasil hitung otomatis dari satuan dasar, karena harga tidak selalu proporsional (contoh: 1 batang rokok Rp2.000, tapi 1 bungkus isi 12 batang dijual Rp18.000, bukan Rp24.000). Konversi satuan hanya dipakai untuk memotong stok, bukan untuk menghitung harga.*

- Field khusus **"boleh dijual eceran: ya/tidak"** per barang.
- Field **"tampilkan di E-Commerce: ya/tidak"** per barang — supaya Orang Tua bisa pilih barang mana saja yang dipajang online (tidak semua stok toko otomatis dijual online).
- Field **kode barcode** per barang/satuan jual — dipakai untuk scan cepat di Kasir (lihat 7.1).

### 3.2 Paket Glosir untuk Acara (Hajatan, Nikahan, dll.)

**Status:** Database model, CRUD API, automatic/manual pricing, admin page, public catalog, cart integration, and checkout stock deduction are implemented.

Selain dijual satuan/eceran, barang Glosir bisa **dipaketkan** untuk kebutuhan acara besar — mirip konsep Parsel, tapi berbasis kebutuhan grosir dalam jumlah besar.

| Fitur | Keterangan |
| --- | --- |
| Buat paket acara | Kombinasikan beberapa barang Glosir + jumlah masing-masing menjadi satu paket bernama (mis. "Paket Sembako Hajatan 50 Porsi", "Paket Nikahan Hemat"). |
| Harga paket | Bisa dihitung otomatis dari harga satuan barang penyusun, atau di-set manual (harga khusus borongan/negosiasi). |
| Custom request | Pelanggan bisa request kombinasi sendiri lewat WhatsApp (mis. "mau paket buat 100 porsi tapi ganti minyak ke merek lain") — dicatat sebagai pesanan custom, bukan harus dari paket baku. |
| Stok otomatis terpotong | Saat paket acara terjual, stok tiap barang penyusun ikut terpotong sesuai isi paket. |
| Tampil di E-Commerce | Paket acara ditampilkan sebagai kategori tersendiri di etalase online Glosir, dengan foto & deskripsi. |

### 3.3 Rekomendasi Restock (Barang Perlu Dibeli)

**Status:** API and dashboard recommendations are implemented from 14-day `OUT` movement averages; final purchase quantity remains manually editable.

Sistem menghitung otomatis daftar barang yang perlu dibeli untuk hari berikutnya, berdasarkan stok saat ini dan rata-rata penjualan harian (gabungan penjualan kasir + online). Hasil ini tetap bisa diedit manual sebelum dijadikan daftar belanja final.

| Barang | Stok Sekarang | Rata-rata Laku/Hari | Saran Sistem | Jumlah Beli (bisa diedit) |
| --- | --- | --- | --- | --- |
| Terigu | 3 kg | 5 kg | 12 kg | diisi manual |
| Kopi Sachet | 2 renceng | 1,5 renceng | 5 renceng | diisi manual |

### 3.4 Fitur Lain di Modul Glosir

| Fitur | Keterangan |
| --- | --- |
| Stok masuk & keluar | Tercatat otomatis dari transaksi kasir, pesanan online, & input pembelian, dalam satuan dasar. |
| Utang-piutang pelanggan | Sistem tempo/kredit untuk pelanggan langganan. |
| Stok opname | **Implemented:** physical/system reconciliation, stock adjustment, movement record, and history. |
| Alert kadaluarsa | Notifikasi barang yang mendekati tanggal kadaluarsa, supaya bisa dijual/diskon lebih dulu. |
| Deteksi jual rugi | Peringatan otomatis jika transaksi terjadi dengan harga jual di bawah harga modal. |
| Log audit harga & stok | **Implemented:** variant price/stock changes record user, timestamp, and old/new values. |
| Laporan untung vs laku | Membedakan barang paling laris dengan barang paling menguntungkan. |

---

## 4. Modul Parsel

Menangani produk rakitan/kombinasi, dijual baik langsung di toko maupun lewat E-Commerce.

| Fitur | Keterangan |
| --- | --- |
| Data bahan/isi parsel | Diambil dari stok barang Glosir bila bahan yang sama dipakai di kedua modul. |
| "Resep" paket parsel | Kombinasi bahan + jumlah per paket → sistem otomatis menghitung harga pokok & menyarankan harga jual. |
| Pemotongan stok otomatis | **Implemented for POS checkout:** stok varian bahan parsel berkurang atomik dan `StockMovement` tercatat per varian. |
| Pesanan / pre-order | Catat nama pelanggan, tanggal ambil, jumlah, status pesanan (dipesan/diproses/selesai) — baik dari toko langsung maupun dari pesanan online via WA. |
| Custom parsel | Pelanggan bisa minta isi parsel disesuaikan lewat WA, dicatat sebagai varian custom dari resep dasar. |
| Tampil di E-Commerce | Katalog parsel (paket standar + galeri contoh) ditampilkan di etalase online, kategori terpisah dari Glosir. |

---

## 5. Modul E-Commerce (Etalase Online + Pemesanan via WhatsApp)

Ini adalah "wajah depan" toko untuk pelanggan yang tidak datang langsung. Sistem checkout **tidak pakai pembayaran online otomatis** — alur pemesanan diarahkan ke WhatsApp supaya tetap fleksibel (nego, konfirmasi ongkir, dll), sesuai kebiasaan pelanggan.

### 5.1 Struktur Etalase

| Fitur | Keterangan |
| --- | --- |
| 2 kategori utama | **Glosir** (barang satuan/eceran + paket acara/hajatan) dan **Parsel** (paket parsel standar + custom). |
| Halaman produk | Foto, deskripsi, pilihan satuan/varian, harga, status stok (tersedia/menipis/habis). |
| Keranjang / daftar pesanan | Pelanggan pilih beberapa barang/paket dulu sebelum lanjut ke WA, supaya pesan ke WA sudah rapi berisi daftar barang. |
| Tombol "Pesan via WhatsApp" | Setelah pelanggan menyusun daftar pesanan, sistem otomatis menyusun template pesan WA (isi pesanan, jumlah, estimasi harga) yang tinggal dikirim ke nomor toko. |
| Riwayat pesanan online | Pesanan yang masuk lewat WA dicatat manual/semi-otomatis oleh Kasir/Owner ke sistem, supaya tetap masuk hitungan stok & keuangan. |

### 5.2 Promo, Diskon & Event

| Fitur | Keterangan |
| --- | --- |
| Diskon per barang/paket | Owner bisa set diskon (persen/nominal) untuk barang atau paket tertentu, dengan tanggal mulai & berakhir. |
| Event/promo musiman | Buat "event" (mis. "Promo Ramadhan", "Diskon Akhir Tahun") yang mengumpulkan beberapa barang/paket dengan diskon khusus, ditampilkan sebagai banner/halaman khusus di etalase. |
| Label otomatis | Barang yang sedang promo ditandai otomatis (badge "Diskon", "Event") di etalase tanpa perlu edit manual per barang. |
| Riwayat promo | Catatan promo yang pernah dijalankan & pengaruhnya ke penjualan (opsional, untuk evaluasi ke depan). |

---

## 6. Modul Keuangan

Membantu Orang Tua mengelola keuangan usaha maupun rencana keuangan jangka panjang, **terhubung otomatis** ke penjualan supaya tidak perlu catat dobel.

| Fitur | Keterangan |
| --- | --- |
| Pemasukan otomatis | Setiap transaksi Kasir dan pesanan E-Commerce (setelah dikonfirmasi) otomatis tercatat sebagai pemasukan di Keuangan — dipisah per sumber (Glosir toko, Glosir online, Parsel). |
| Pengeluaran | Pencatatan pengeluaran harian/bulanan dengan kategori (operasional toko, rumah tangga, lain-lain). |
| Tabungan bertujuan | Pos tabungan terpisah (contoh: Dana Kuliah, Dana Darurat, Beli Kendaraan) dengan target nominal, target tanggal opsional, dan progres visual. |
| Catatan utang | Dua arah: utang usaha ke supplier, dan piutang dari pelanggan. Mencatat nominal, tanggal, jatuh tempo, status lunas/belum, dan kemungkinan cicilan. |
| Alokasi manual | Keuntungan dari penjualan dapat dialokasikan ke pos tabungan/pelunasan utang, namun tetap melalui persetujuan manual Orang Tua — tidak otomatis terpotong. |
| Ringkasan keuangan | Laporan sederhana: total masuk vs keluar per periode, saldo tiap pos tabungan, total utang-piutang berjalan — supaya Orang Tua tinggal lihat, tidak perlu hitung manual. |

---

## 7. Fitur Pendukung Lintas Modul

### 7.1 Mempercepat Transaksi Kasir

| Fitur | Keterangan |
| --- | --- |
| Scan barcode barang | Kasir input barang ke transaksi dengan scan barcode (pakai barcode scanner fisik atau kamera HP), otomatis ambil harga & satuan jual dari data barang. |
| Cetak struk pakai printer thermal | Struk transaksi langsung dicetak lewat printer/scanner struk yang terhubung ke sistem kasir. |
| Tombol barang favorit | Barang yang sering dibeli muncul sebagai tombol cepat di halaman kasir, buat barang yang belum ada barcode-nya. |
| Search cepat | Cari barang dengan nama atau kode singkat. |
| Kalkulator kembalian | Otomatis menghitung kembalian dari nominal uang yang dibayarkan. |
| Kirim struk digital | Selain cetak fisik, struk juga bisa dikirim ke pelanggan via WhatsApp. |
| Konfirmasi nominal janggal | Peringatan jika nominal transaksi jauh berbeda dari rata-rata biasanya. |
| Void transaksi | Pembatalan transaksi dengan catatan alasan, untuk keperluan audit. |
| Tutup kasir harian | Cocokkan total transaksi sistem dengan uang fisik di laci di akhir hari. |

### 7.1.1 Poin & Loyalitas Pelanggan

| Fitur | Keterangan |
| --- | --- |
| Poin per transaksi | Setiap transaksi dengan total belanja di atas **Rp100.000** otomatis mendapat poin (jumlah poin per kelipatan nominal bisa diatur Owner). |
| Berlaku di Kasir & E-Commerce | Poin dihitung dari transaksi toko maupun pesanan online yang sudah dikonfirmasi, terkumpul ke akun pelanggan yang sama. |
| Riwayat poin pelanggan | Owner/Kasir bisa cek total poin & riwayat perolehan poin per pelanggan (butuh data pelanggan minimal nama/nomor HP saat transaksi). |
| Penukaran poin | Poin bisa ditukar jadi diskon transaksi berikutnya — aturan tukar poin (mis. 100 poin = diskon Rp10.000) diatur manual oleh Owner. |

### 7.2 Mengelola Pesanan Online & WhatsApp

| Fitur | Keterangan |
| --- | --- |
| Notifikasi pesanan baru | Owner/Kasir dapat notifikasi di dashboard saat ada pesanan baru dari template WA yang diinput ke sistem. |
| Status pesanan online | Tandai pesanan: baru masuk / dikonfirmasi / diproses / dikirim-diambil / selesai. |
| Integrasi ke stok & keuangan | Begitu pesanan online ditandai selesai, stok & pemasukan otomatis ter-update, tidak perlu input dobel. |

### 7.3 Kemudahan untuk Orang Tua

| Fitur | Keterangan |
| --- | --- |
| Ringkasan WhatsApp malam hari | Kirim otomatis rekap omzet (toko + online), stok menipis, dan piutang jatuh tempo setiap malam. |
| Mode lihat-saja di HP | Orang tua bisa memantau omzet, stok & pesanan online dari HP tanpa perlu membuka laptop. |
| Notifikasi stok kritis | Muncul langsung di halaman utama begitu login. |

### 7.4 Mempercepat Input Data

| Fitur | Keterangan |
| --- | --- |
| Scan nota belanja (OCR) | Foto nota dari supplier lewat kamera HP, sistem membaca otomatis untuk update stok masuk. |
| Import dari Excel | Untuk memasukkan data barang yang sudah ada di catatan Excel sebelumnya, tanpa input ulang manual. |

### 7.5 Piutang

| Fitur | Keterangan |
| --- | --- |
| Reminder WA otomatis | Dikirim ke pelanggan dengan piutang yang sudah lama belum dibayar. |
| Riwayat ringkas per pelanggan | Total utang dan tanggal terakhir bayar, mudah dicek saat pelanggan datang. |

### 7.6 Kontrol & Keamanan Data

| Fitur | Keterangan |
| --- | --- |
| Backup data otomatis | Backup harian otomatis (mis. ke cloud/email) agar data tidak hilang jika perangkat bermasalah. |

---

## 8. Urutan Pengembangan (Roadmap)

Supaya sistem bisa mulai dipakai lebih cepat tanpa menunggu semua fitur selesai, pengembangan disarankan bertahap:

| Fase | Cakupan |
| --- | --- |
| Fase 1 — Inti | Login & role, data barang + sistem satuan, Kasir dasar (transaksi + kalkulator kembalian), stok masuk-keluar. |
| Fase 2 — Penguatan Glosir & Kasir | Rekomendasi restock, utang-piutang pelanggan, tutup kasir harian, stok opname, cetak/kirim struk. |
| Fase 3 — E-Commerce & Parsel | Etalase online (Glosir & Parsel), tombol pesan via WhatsApp, Modul Parsel lengkap (resep, pre-order), paket acara/hajatan Glosir. |
| Fase 4 — Keuangan Terintegrasi | Pemasukan otomatis dari Kasir + E-Commerce ke Keuangan, pengeluaran, tabungan bertujuan, catatan utang, alokasi manual. |
| Fase 5 — Promo & Otomasi Lanjutan | Diskon & event/promo di E-Commerce, notifikasi WA (rekap malam, reminder piutang), OCR nota, import Excel, deteksi jual rugi, log audit, laporan untung vs laku. |

*Dokumen ini adalah rancangan konsep. Struktur database (tabel & kolom), alur pesan WhatsApp, dan mockup tampilan akan disusun sebagai langkah lanjutan berdasarkan blueprint ini.*
