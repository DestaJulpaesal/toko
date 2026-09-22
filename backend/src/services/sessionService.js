import jwt from 'jsonwebtoken';

// Sesi login = token JWT + PENGECEKAN ULANG ke database.
//
// Dulu token dipercaya begitu saja sampai kedaluwarsa (8 jam, atau 30 hari untuk OWNER "ingat saya"),
// sehingga karyawan yang sudah dinonaktifkan, atau perangkat yang hilang setelah password diganti,
// tetap bisa masuk. Sekarang setiap request divalidasi ke tabel User:
//   1. akun masih aktif?
//   2. nomor versi token (tokenVersion) masih sama? Naik saat password diganti / "keluar dari perangkat lain".
//   3. role diambil dari database (bukan dari isi token), jadi perubahan role langsung berlaku.
//
// Hasil pengecekan disimpan singkat di memori (10 detik) supaya tidak menambah beban database di setiap klik.
// Artinya penonaktifan akun berlaku paling lambat sekitar 10 detik, dan langsung bila lewat `invalidate`.

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib di-set di environment variable');
  return process.env.JWT_SECRET;
};

export const SESSION_CACHE_TTL_MS = 10_000;

export function createSessionService({ loadUser, ttlMs = SESSION_CACHE_TTL_MS, now = Date.now } = {}) {
  const cache = new Map(); // userId -> { at, user }

  async function findUser(id) {
    const hit = cache.get(id);
    if (hit && now() - hit.at < ttlMs) return hit.user;
    const user = (await loadUser(id)) ?? null;
    cache.set(id, { at: now(), user });
    return user;
  }

  // Mengembalikan { ok: true, user } atau { ok: false, reason: 'expired' | 'invalid' | 'inactive' | 'revoked' }.
  // Melempar error kalau database bermasalah (pemanggil yang menentukan sikapnya).
  async function authenticate(token) {
    const secret = getJwtSecret();
    let decoded;
    try {
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch (error) {
      return { ok: false, reason: error?.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
    }
    if (typeof decoded?.id !== 'string') return { ok: false, reason: 'invalid' };

    const record = await findUser(decoded.id);
    if (!record || !record.isActive) return { ok: false, reason: 'inactive' };
    if (Number(decoded.tv ?? 0) !== Number(record.tokenVersion ?? 0)) return { ok: false, reason: 'revoked' };

    return {
      ok: true,
      user: {
        id: record.id,
        email: record.email,
        name: record.name,
        role: record.role, // dari database, bukan dari token
        regionId: record.regionId || null,
        iat: decoded.iat,
        exp: decoded.exp,
      },
    };
  }

  return {
    authenticate,
    invalidate: (userId) => cache.delete(userId),
    clear: () => cache.clear(),
  };
}

// Prisma dimuat saat dibutuhkan saja (bukan saat file ini di-import), supaya bagian ini mudah dites.
async function loadUserFromDatabase(id) {
  const { default: prisma } = await import('../config/db.js');
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true, regionId: true, tokenVersion: true },
  });
}

export const sessions = createSessionService({ loadUser: loadUserFromDatabase });
