import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const records = await prisma.stockOpname.findMany({
    include: {
      variant: { include: { product: { select: { name: true } } } },
      performedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, records });
});

router.post('/', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const { variantId, physicalQty, note } = req.body || {};
  const physical = Number(physicalQty);
  if (!variantId || !Number.isInteger(physical) || physical < 0) {
    return res.status(400).json({ success: false, message: 'Varian dan jumlah fisik yang valid wajib diisi' });
  }

  try {
    const record = await prisma.$transaction(async (transaction) => {
      const variant = await transaction.productVariant.findUnique({ where: { id: String(variantId) } });
      if (!variant) throw Object.assign(new Error('Varian tidak ditemukan'), { statusCode: 404 });
      const difference = physical - variant.stockQty;
      await transaction.productVariant.update({ where: { id: variant.id }, data: { stockQty: physical } });
      await transaction.stockMovement.create({
        data: {
          productId: variant.productId,
          variantId: variant.id,
          type: 'ADJUSTMENT',
          quantity: difference,
          note: note ? String(note).trim() : 'Stok opname',
          reference: 'STOCK_OPNAME',
        },
      });
      return transaction.stockOpname.create({
        data: {
          variantId: variant.id,
          systemQty: variant.stockQty,
          physicalQty: physical,
          difference,
          note: note ? String(note).trim() : null,
          performedById: req.user.id,
        },
        include: { variant: { include: { product: { select: { name: true } } } } },
      });
    });
    return res.status(201).json({ success: true, record });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Stok opname gagal disimpan' });
  }
});

router.delete('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.stockOpname.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Catatan opname dihapus. Stok sistem tidak diubah.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Catatan opname tidak ditemukan' : 'Catatan opname gagal dihapus',
    });
  }
});

export default router;
