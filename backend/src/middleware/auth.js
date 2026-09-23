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
