<<<<<<< HEAD
import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib di-set di environment variable');
  return process.env.JWT_SECRET;
};

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token missing' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Token invalid' });
  }
}

=======
import { sessions as defaultSessions } from '../services/sessionService.js';

const bearerToken = (req) => {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.split(' ')[1];
};

const REASON_MESSAGES = {
  expired: 'Sesi sudah berakhir. Silakan masuk lagi.',
  invalid: 'Sesi tidak valid. Silakan masuk lagi.',
  inactive: 'Akun ini sudah tidak aktif.',
  revoked: 'Sesi berakhir karena password diganti atau keluar dari perangkat lain. Silakan masuk lagi.',
};

export function createAuth(sessions = defaultSessions) {
  // Wajib login. Semua kegagalan sesi dijawab 401 (bukan 403), sehingga frontend otomatis
  // mengeluarkan pengguna ke halaman login. 403 dipakai khusus untuk "login benar tapi tidak berhak".
  const authenticateToken = async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Token missing' });

    try {
      const result = await sessions.authenticate(token);
      if (!result.ok) {
        return res.status(401).json({ success: false, message: REASON_MESSAGES[result.reason], code: result.reason });
      }
      req.user = result.user;
      return next();
    } catch (error) {
      console.error('Session check failed:', error.message);
      return res.status(503).json({ success: false, message: 'Sesi belum bisa diperiksa. Coba lagi sebentar.' });
    }
  };

  // Untuk endpoint publik yang isinya bergantung pada siapa yang membuka (pengunjung vs staf).
  // Sesi valid -> req.user terisi. Tidak ada token, token kedaluwarsa/rusak/dicabut, atau database bermasalah
  // -> dianggap pengunjung biasa (hak paling rendah). Tidak pernah membalas error, supaya katalog publik
  // tidak rusak hanya karena browser masih menyimpan token lama.
  const softAuth = async (req, res, next) => {
    const token = bearerToken(req);
    if (token) {
      try {
        const result = await sessions.authenticate(token);
        if (result.ok) req.user = result.user;
      } catch (error) {
        console.error('Soft session check failed:', error.message);
      }
    }
    return next();
  };

  return { authenticateToken, softAuth };
}

const auth = createAuth();

export const authenticateToken = auth.authenticateToken;
export const softAuth = auth.softAuth;

>>>>>>> cbd8857 (push fitur notifikasi email)
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden for this role' });
    }

    next();
  };
}
<<<<<<< HEAD

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, getJwtSecret());
  } catch {
    return res.status(403).json({ success: false, message: 'Token invalid' });
  }
  return next();
}
=======
>>>>>>> cbd8857 (push fitur notifikasi email)
