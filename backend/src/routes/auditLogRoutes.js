import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER'));

router.get('/', async (req, res) => {
  try {
    const where = req.query.entityId ? { entityId: String(req.query.entityId) } : undefined;
    const logs = await prisma.auditLog.findMany({
      where,
      include: { changedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json({ success: true, logs });
  } catch (error) {
    console.error('Audit log load failed:', error.message);
    return res.status(503).json({ success: false, message: 'Riwayat perubahan belum dapat dimuat.' });
  }
});

export default router;
