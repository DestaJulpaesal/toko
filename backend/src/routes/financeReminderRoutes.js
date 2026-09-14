import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { z } from 'zod';

const reminderSchema = z.object({
  type: z.string().trim().min(1),
  refId: z.string().optional().nullable(),
  title: z.string().trim().min(1),
  dueDate: z.union([z.string(), z.date()]),
  channel: z.enum(['APP', 'WHATSAPP', 'EMAIL']).default('APP'),
});
const router = express.Router();
router.use(authenticateToken);
router.get('/', async (req, res) => {
  const rows = await prisma.financeReminder.findMany({ where: { ...(req.query.status ? { status: String(req.query.status) } : {}) }, orderBy: { dueDate: 'asc' }, take: 100 });
  return res.json({ success: true, data: rows });
});
router.post('/', requireRole('OWNER', 'ADMIN'), validateBody(reminderSchema), async (req, res) => {
  const row = await prisma.financeReminder.create({ data: { ...req.body, dueDate: new Date(req.body.dueDate) } });
  return res.status(201).json({ success: true, data: row });
});
router.patch('/:id/dismiss', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const row = await prisma.financeReminder.update({ where: { id: req.params.id }, data: { status: 'DISMISSED' } });
    return res.json({ success: true, data: row });
  } catch {
    return res.status(404).json({ success: false, message: 'Reminder tidak ditemukan.' });
  }
});
export default router;
