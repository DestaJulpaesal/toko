import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { financeCategorySchema, validateBody } from '../middleware/security.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));

const activeWhere = (query = {}) => ({
  deletedAt: null,
  ...(query.type && String(query.type).toUpperCase() !== 'ALL'
    ? { type: String(query.type).toUpperCase() }
    : {}),
});

router.get('/', async (req, res) => {
  try {
    const categories = await prisma.financeCategory.findMany({
      where: activeWhere(req.query),
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return res.json({ success: true, data: categories });
  } catch (error) {
    return res.status(503).json({ success: false, message: 'Kategori keuangan tidak dapat diambil.' });
  }
});

router.post('/', validateBody(financeCategorySchema), async (req, res) => {
  try {
    const category = await prisma.financeCategory.create({ data: req.body });
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    return res.status(error.code === 'P2002' ? 409 : 400).json({
      success: false,
      message: error.code === 'P2002' ? 'Kategori dengan nama dan jenis tersebut sudah ada.' : error.message,
    });
  }
});

router.patch('/:id', validateBody(financeCategorySchema.partial()), async (req, res) => {
  try {
    const existing = await prisma.financeCategory.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    const category = await prisma.financeCategory.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return res.json({ success: true, data: category });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Kategori gagal diperbarui.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const used = await prisma.financeTransaction.count({ where: { categoryId: req.params.id, deletedAt: null } });
    if (used > 0) return res.status(409).json({ success: false, message: 'Kategori masih dipakai transaksi aktif.' });
    const existing = await prisma.financeCategory.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    const category = await prisma.financeCategory.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return res.json({ success: true, data: category, message: 'Kategori dipindahkan ke arsip.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Kategori gagal dihapus.' });
  }
});

export default router;
