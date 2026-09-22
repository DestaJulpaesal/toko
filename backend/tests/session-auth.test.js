// Tes: sesi login harus dicek ulang ke database (akun dinonaktifkan, password diganti, role berubah).
// Jalankan: npm run test:session   (tidak butuh database, memakai data palsu)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createAuth, requireRole } from '../src/middleware/auth.js';
import { createSessionService } from '../src/services/sessionService.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'rahasia-khusus-tes';
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- "Database" palsu + jam palsu ----------
const users = new Map();
let clock = 1_000_000;
let loadCalls = 0;
let databaseDown = false;
const resetUsers = () => {
  users.clear();
  users.set('u-owner', { id: 'u-owner', name: 'Ibu', email: 'ibu@tes.local', role: 'OWNER', isActive: true, regionId: null, tokenVersion: 0 });
  users.set('u-kasir', { id: 'u-kasir', name: 'Budi', email: 'budi@tes.local', role: 'CASHIER', isActive: true, regionId: null, tokenVersion: 0 });
  loadCalls = 0;
  databaseDown = false;
  sessions.clear();
};
const sessions = createSessionService({
  now: () => clock,
  loadUser: async (id) => {
    loadCalls += 1;
    if (databaseDown) throw new Error('database mati');
    return users.get(id) ?? null;
  },
});
const { authenticateToken, softAuth } = createAuth(sessions);

const app = express();
app.get('/rahasia', authenticateToken, (req, res) => res.json({ success: true, user: req.user }));
app.get('/khusus-owner', authenticateToken, requireRole('OWNER'), (req, res) => res.json({ success: true }));
app.get('/publik', softAuth, (req, res) => res.json({ success: true, role: req.user?.role ?? null }));
const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const sign = (payload, options = {}, secret = process.env.JWT_SECRET) => jwt.sign(payload, secret, { expiresIn: '8h', ...options });
const get = async (url, token) => {
  const response = await fetch(`${baseUrl}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
};

// ---------- Login normal ----------
test('sesi valid: akun aktif diterima, data user diambil dari database', async () => {
  resetUsers();
  const { status, body } = await get('/rahasia', sign({ id: 'u-owner', role: 'OWNER', tv: 0 }));
  assert.equal(status, 200);
  assert.equal(body.user.id, 'u-owner');
  assert.equal(body.user.name, 'Ibu');
});

test('token lama tanpa penanda versi (tv) tetap diterima selama versi di database masih 0', async () => {
  resetUsers();
  const { status } = await get('/rahasia', sign({ id: 'u-owner', role: 'OWNER' }));
  assert.equal(status, 200);
});

// ---------- Akun dinonaktifkan ----------
test('akun dinonaktifkan: token yang masih berlaku ditolak 401 (bukan 403)', async () => {
  resetUsers();
  const token = sign({ id: 'u-kasir', role: 'CASHIER', tv: 0 }, { expiresIn: '30d' });
  assert.equal((await get('/rahasia', token)).status, 200);
  users.get('u-kasir').isActive = false;
  sessions.invalidate('u-kasir'); // yang dilakukan route saat akun dinonaktifkan
  const after = await get('/rahasia', token);
  assert.equal(after.status, 401);
  assert.equal(after.body.code, 'inactive');
});

test('akun yang dihapus dari database juga ditolak', async () => {
  resetUsers();
  users.delete('u-kasir');
  assert.equal((await get('/rahasia', sign({ id: 'u-kasir', role: 'CASHIER', tv: 0 }))).status, 401);
});

// ---------- Password diganti / keluar dari perangkat lain ----------
test('nomor versi token naik: token lama dicabut, token baru diterima', async () => {
  resetUsers();
  const oldToken = sign({ id: 'u-owner', role: 'OWNER', tv: 0 });
  assert.equal((await get('/rahasia', oldToken)).status, 200);
  users.get('u-owner').tokenVersion = 1; // password diganti
  sessions.invalidate('u-owner');
  const revoked = await get('/rahasia', oldToken);
  assert.equal(revoked.status, 401);
  assert.equal(revoked.body.code, 'revoked');
  assert.equal((await get('/rahasia', sign({ id: 'u-owner', role: 'OWNER', tv: 1 }))).status, 200);
});

// ---------- Role ----------
test('role diambil dari database: token yang mengaku OWNER tapi akunnya kasir tidak boleh lolos', async () => {
  resetUsers();
  const tokenPalsu = sign({ id: 'u-kasir', role: 'OWNER', tv: 0 });
  const { status } = await get('/khusus-owner', tokenPalsu);
  assert.equal(status, 403);
});

test('role diturunkan di database: langsung berlaku setelah cache habis, tanpa menunggu token kedaluwarsa', async () => {
  resetUsers();
  const token = sign({ id: 'u-owner', role: 'OWNER', tv: 0 }, { expiresIn: '30d' });
  assert.equal((await get('/khusus-owner', token)).status, 200);
  users.get('u-owner').role = 'CASHIER';
  clock += 11_000; // lewat masa simpan cache 10 detik
  assert.equal((await get('/khusus-owner', token)).status, 403);
});

// ---------- Token rusak ----------
test('token kedaluwarsa, ngawur, atau salah algoritma: 401 dengan alasan jelas', async () => {
  resetUsers();
  const expired = await get('/rahasia', sign({ id: 'u-owner', tv: 0 }, { expiresIn: -10 }));
  assert.equal(expired.status, 401);
  assert.equal(expired.body.code, 'expired');
  assert.equal((await get('/rahasia', 'bukan.token.valid')).status, 401);
  assert.equal((await get('/rahasia', sign({ id: 'u-owner', tv: 0 }, { algorithm: 'HS512' }))).status, 401);
  assert.equal((await get('/rahasia', sign({ id: 'u-owner', tv: 0 }, {}, 'rahasia-orang-lain'))).status, 401);
  const tanpaToken = await get('/rahasia');
  assert.equal(tanpaToken.status, 401);
});

// ---------- Cache ----------
test('cache: dua request berdekatan hanya membaca database sekali, lalu baca lagi setelah 10 detik', async () => {
  resetUsers();
  const token = sign({ id: 'u-owner', tv: 0 });
  await get('/rahasia', token);
  await get('/rahasia', token);
  assert.equal(loadCalls, 1);
  clock += 11_000;
  await get('/rahasia', token);
  assert.equal(loadCalls, 2);
});

// ---------- Database bermasalah ----------
test('database mati: endpoint wajib login menjawab 503, endpoint publik tetap jalan sebagai pengunjung', async () => {
  resetUsers();
  databaseDown = true;
  const token = sign({ id: 'u-owner', tv: 0 });
  assert.equal((await get('/rahasia', token)).status, 503);
  const publik = await get('/publik', token);
  assert.equal(publik.status, 200);
  assert.equal(publik.body.role, null);
});

// ---------- softAuth (halaman publik) ----------
test('softAuth: sesi yang sudah dicabut/nonaktif tidak lagi dianggap staf', async () => {
  resetUsers();
  const token = sign({ id: 'u-owner', role: 'OWNER', tv: 0 });
  assert.equal((await get('/publik', token)).body.role, 'OWNER');
  users.get('u-owner').isActive = false;
  sessions.invalidate('u-owner');
  const after = await get('/publik', token);
  assert.equal(after.status, 200);
  assert.equal(after.body.role, null);
  assert.equal((await get('/publik', 'token.ngawur.sekali')).body.role, null);
  assert.equal((await get('/publik')).body.role, null);
});

// ---------- Memastikan kode penerbit token dan route memakai aturan ini ----------
test('kode: password diganti/reset selalu menaikkan tokenVersion dan mencabut cache sesi', () => {
  const read = (file) => fs.readFileSync(path.join(backendDir, file), 'utf8');
  const authService = read('src/services/authService.js');
  assert.match(authService, /tv: Number\(user\.tokenVersion \?\? 0\)/);
  assert.equal((authService.match(/tokenVersion: \{ increment: 1 \}/g) || []).length, 3); // ganti password, reset password, keluar dari perangkat lain
  assert.equal((authService.match(/sessions\.invalidate\(/g) || []).length, 3);
  assert.match(authService, /"tokenVersion"/); // ikut dibaca saat login
  const authRoutes = read('src/routes/authRoutes.js');
  assert.match(authRoutes, /router\.post\('\/logout-others', authenticateToken/);
  assert.match(authRoutes, /const token = generateToken\(user, false, remainingSessionSeconds\(req\.user\)\)/);
  assert.match(read('src/routes/parcelManagerRoutes.js'), /sessions\.invalidate\(user\.id\)/);
  assert.match(read('prisma/schema.prisma'), /tokenVersion\s+Int\s+@default\(0\)/);
  const migrations = fs.readdirSync(path.join(backendDir, 'prisma/migrations')).filter((name) => name.includes('token_version'));
  assert.equal(migrations.length, 1);
});
