import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { z } from 'zod';

const tagSchema = z.object({ name: z.string().trim().min(1), color: z.string().trim().optional().nullable() });
const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));

router.get('/', async (req, res) => {
  const tags = await prisma.financeTag.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  return res.json({ success: true, data: tags });
});
router.post('/', validateBody(tagSchema), async (req, res) => {
  try {
    const tag = await prisma.financeTag.create({ data: req.body });
    return res.status(201).json({ success: true, data: tag });
  } catch (error) {
    return res.status(error.code === 'P2002' ? 409 : 400).json({ success: false, message: 'Tag sudah ada atau tidak valid.' });
  }
});
router.patch('/:id', validateBody(tagSchema.partial()), async (req, res) => {
  try {
    const tag = await prisma.financeTag.update({ where: { id: req.params.id }, data: req.body });
    return res.json({ success: true, data: tag });
  } catch {
    return res.status(404).json({ success: false, message: 'Tag tidak ditemukan.' });
  }
});
router.delete('/:id', async (req, res) => {
  const result = await prisma.financeTag.updateMany({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!result.count) return res.status(404).json({ success: false, message: 'Tag tidak ditemukan.' });
  return res.json({ success: true, message: 'Tag dipindahkan ke arsip.' });
});
export default router;
