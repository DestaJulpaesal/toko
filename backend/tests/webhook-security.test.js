// Tes: webhook WhatsApp harus menolak request tanpa secret yang benar,
// tidak boleh diproses dua kali untuk pesan yang sama, dan tidak boleh terbuka
// kalau server lupa mengisi secret-nya.
// Jalankan: npm run test:webhook   (tidak butuh koneksi Fonnte asli)
import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdempotencyGuard, verifyWebhookSecret } from '../src/services/webhookSecurity.js';

const withSecret = (value, fn) => {
  const before = process.env.WHATSAPP_WEBHOOK_SECRET;
  process.env.WHATSAPP_WEBHOOK_SECRET = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
    else process.env.WHATSAPP_WEBHOOK_SECRET = before;
  }
};

// ---------- verifyWebhookSecret ----------
test('secret benar via header: diterima', () => {
  withSecret('rahasia-toko', () => {
    const result = verifyWebhookSecret({ headers: { 'x-webhook-secret': 'rahasia-toko' } });
    assert.equal(result.ok, true);
  });
});

test('secret salah: ditolak 401, bukan 500 atau lolos', () => {
  withSecret('rahasia-toko', () => {
    const result = verifyWebhookSecret({ headers: { 'x-webhook-secret': 'tebakan-ngawur' } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });
});

test('secret dikirim lewat body (bukan header): tetap ditolak', () => {
  withSecret('rahasia-toko', () => {
    // Dulu kode lama menerima `req.body.secret` sebagai alternatif. Sekarang HANYA header yang dibaca.
    const result = verifyWebhookSecret({ headers: {}, body: { secret: 'rahasia-toko' } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });
});

test('secret panjang berbeda: tidak error, tetap ditolak rapi (bukan 500)', () => {
  withSecret('rahasia-toko-yang-panjang', () => {
    const result = verifyWebhookSecret({ headers: { 'x-webhook-secret': 'pendek' } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });
});

test('server LUPA mengisi WHATSAPP_WEBHOOK_SECRET: webhook menutup diri (fail closed), bukan menerima semua orang', () => {
  withSecret('', () => {
    const result = verifyWebhookSecret({ headers: { 'x-webhook-secret': 'apa saja' } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 503); // bukan 200 — dulu ini celahnya: secret kosong = webhook terbuka untuk siapa saja
  });
});

test('tidak ada header sama sekali: ditolak, tidak melempar error', () => {
  withSecret('rahasia-toko', () => {
    const result = verifyWebhookSecret({ headers: {} });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });
});

// ---------- createIdempotencyGuard ----------
test('pesan yang sama, dikirim dua kali (retry provider): kedua kali dianggap duplikat', () => {
  const guard = createIdempotencyGuard();
  assert.equal(guard.isDuplicate('628123', 'catat masuk 50rb jual pulsa', 't1'), false); // pertama kali: bukan duplikat
  assert.equal(guard.isDuplicate('628123', 'catat masuk 50rb jual pulsa', 't1'), true); // kedua kali: duplikat, tidak diproses lagi
});

test('pesan beda, atau dari pengirim beda: tidak dianggap duplikat', () => {
  const guard = createIdempotencyGuard();
  assert.equal(guard.isDuplicate('628123', 'saldo', 't1'), false);
  assert.equal(guard.isDuplicate('628123', 'saldo', 't2'), false); // waktu kirim beda -> perintah baru
  assert.equal(guard.isDuplicate('628999', 'saldo', 't1'), false); // pengirim beda
});

test('setelah lewat waktu penyimpanan (TTL), pesan yang sama boleh diproses lagi', () => {
  let now = 1_000_000;
  const guard = createIdempotencyGuard({ ttlMs: 5_000, now: () => now });
  assert.equal(guard.isDuplicate('628123', 'saldo', 't1'), false);
  now += 6_000;
  assert.equal(guard.isDuplicate('628123', 'saldo', 't1'), false); // sudah kedaluwarsa, dianggap perintah baru
});

test('memori tidak menumpuk selamanya: entri kedaluwarsa dibuang', () => {
  let now = 0;
  const guard = createIdempotencyGuard({ ttlMs: 1_000, now: () => now });
  for (let i = 0; i < 50; i += 1) guard.isDuplicate('628123', `pesan-${i}`, 't1');
  assert.equal(guard.size(), 50);
  now += 2_000;
  guard.isDuplicate('628123', 'pesan-baru', 't1'); // memicu pembersihan
  assert.equal(guard.size(), 1);
});

// ---------- Route: memastikan endpoint benar-benar memakai semua perlindungan di atas ----------
test('kode: route webhook memakai verifyWebhookSecret dari header dan idempotency guard', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const routeCode = fs.readFileSync(path.join(backendDir, 'src/routes/whatsappWebhookRoutes.js'), 'utf8');
  assert.match(routeCode, /verifyWebhookSecret\(req\)/);
  assert.match(routeCode, /idempotency\.isDuplicate\(/);

  const securityCode = fs.readFileSync(path.join(backendDir, 'src/services/webhookSecurity.js'), 'utf8');
  // Perbandingan `===` biasa membocorkan waktu proses (bisa dipakai menebak secret karakter demi
  // karakter). timingSafeEqual wajib tetap dipakai, walau secara hasil akhir keduanya terlihat sama.
  assert.match(securityCode, /crypto\.timingSafeEqual\(a, b\)/);
  assert.doesNotMatch(routeCode, /req\.body\?\.secret/); // secret tidak lagi boleh dibaca dari body
  assert.doesNotMatch(routeCode, /providedSecret !== process\.env\.WHATSAPP_WEBHOOK_SECRET/); // bandingkan manual lama dihapus

  const appCode = fs.readFileSync(path.join(backendDir, 'src/app.js'), 'utf8');
  assert.match(appCode, /app\.use\('\/api\/whatsapp\/webhook', whatsappWebhookLimiter, whatsappWebhookRoutes\)/);
});
