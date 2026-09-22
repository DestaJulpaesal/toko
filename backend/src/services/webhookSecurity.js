import crypto from 'node:crypto';

// Aturan verifikasi webhook (berlaku untuk provider mana pun, tidak cuma Fonnte):
// 1. Secret WAJIB terisi. Kalau env kosong, tolak SEMUA request ("fail closed"),
//    bukan malah membuka webhook untuk siapa saja (kebalikan dari kode lama).
// 2. Secret hanya diterima lewat HEADER, tidak pernah dari body. Body bisa dibaca dan
//    diubah siapa saja yang tahu bentuk request-nya; header jauh lebih sulit ditebak dari luar.
// 3. Dibandingkan dengan waktu tetap (timingSafeEqual), supaya perbedaan waktu proses
//    tidak bisa dipakai menebak secret sedikit demi sedikit ("timing attack").
export function verifyWebhookSecret(req, { headerName = 'x-webhook-secret', envVar = 'WHATSAPP_WEBHOOK_SECRET' } = {}) {
  const configured = process.env[envVar];
  if (!configured) return { ok: false, status: 503, message: 'Webhook belum dikonfigurasi di server (secret kosong).' };

  const provided = req.headers[headerName];
  if (!provided || typeof provided !== 'string') return { ok: false, status: 401, message: 'Webhook tidak sah.' };

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  // Buffer beda panjang bikin timingSafeEqual error, bukan false. Baris ini menjaga waktunya
  // tetap konstan (tidak keluar lebih cepat) walau panjangnya beda, lalu tetap dijawab gagal.
  const equalLength = a.length === b.length;
  const matches = equalLength && crypto.timingSafeEqual(a, b);
  if (!matches) return { ok: false, status: 401, message: 'Webhook tidak sah.' };
  return { ok: true };
}

// Fonnte (dan kebanyakan provider WA lain) tidak selalu mengirim ID pesan yang unik untuk
// pesan masuk, dan webhook BISA terkirim dua kali (retry jaringan, provider mengulang).
// Karena ini terhubung ke pencatatan keuangan, pesan yang sama tidak boleh diproses dua kali.
//
// Kunci diambil dari isi pesan (pengirim + isi + menit pengiriman), bukan angka acak, supaya
// pesan yang PERSIS sama dalam rentang waktu pendek dianggap duplikat, sedangkan perintah baru
// dari orang yang sama tetap diproses. Disimpan di memori (bukan database) karena sifatnya
// sementara; kalau server di-restart atau berjalan lebih dari satu proses, cek ini mulai dari nol.
export function createIdempotencyGuard({ ttlMs = 2 * 60 * 1000, now = Date.now } = {}) {
  const seen = new Map(); // key -> kedaluwarsa pada waktu ke-

  const purgeExpired = () => {
    const currentTime = now();
    for (const [key, expiresAt] of seen) if (expiresAt <= currentTime) seen.delete(key);
  };

  return {
    // true kalau pesan ini sudah pernah diproses dalam jendela waktu ttlMs terakhir.
    isDuplicate(...parts) {
      purgeExpired();
      const key = crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex');
      if (seen.has(key)) return true;
      seen.set(key, now() + ttlMs);
      return false;
    },
    size: () => seen.size,
  };
}
