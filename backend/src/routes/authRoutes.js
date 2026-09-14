import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { generateToken, verifyCredentials } from '../services/authService.js';
import { loginLimiter, loginSchema, validateBody } from '../middleware/security.js';
import prisma from '../config/db.js';

const router = express.Router();

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password, rememberMe = false } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi',
    });
  }

  const user = await verifyCredentials(email, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Email atau password salah',
    });
  }

  const token = generateToken(user, Boolean(rememberMe));

  return res.json({
    success: true,
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      regionId: user.regionId || null,
    },
  });
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.patch('/me/dashboard-layout', authenticateToken, async (req, res) => {
  const layout = Array.isArray(req.body?.layout) ? req.body.layout.map(String).slice(0, 20) : null;
  if (!layout) return res.status(400).json({ success: false, message: 'Layout dashboard tidak valid.' });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { dashboardLayout: layout }, select: { dashboardLayout: true } });
  return res.json({ success: true, data: user.dashboardLayout });
});

router.get('/owner-demo', authenticateToken, requireRole('OWNER'), (req, res) => {
  res.json({ success: true, message: 'Akses owner berhasil', user: req.user });
});

router.get('/cashier-demo', authenticateToken, requireRole('CASHIER'), (req, res) => {
  res.json({ success: true, message: 'Akses kasir berhasil', user: req.user });
});

export default router;
