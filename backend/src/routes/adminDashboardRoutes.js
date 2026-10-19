import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getAdminDashboardSummary } from '../services/adminDashboardService.js';

const router = express.Router();

router.get('/summary', authenticateToken, requireRole('OWNER', 'ADMIN'), async (_req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    return res.json(await getAdminDashboardSummary(prisma));
  } catch (error) {
    console.error('Admin dashboard summary failed:', error.message);
    return res.status(503).json({ success: false, message: 'Ringkasan toko belum dapat dimuat. Coba lagi.' });
  }
});

export default router;
