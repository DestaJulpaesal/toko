import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = express.Router();
router.use(authenticateToken);

const serialize = (movement) => ({
  id: movement.id,
  type: movement.type,
  quantity: Number(movement.quantity),
  note: movement.note,
  reference: movement.reference,
  createdAt: movement.createdAt,
  product: movement.product ? { id: movement.product.id, name: movement.product.name, sku: movement.product.sku } : null,
  variant: movement.variant ? { id: movement.variant.id, name: movement.variant.name, sku: movement.variant.sku, unit: movement.variant.unit } : null,
  changedBy: movement.changedBy ? { id: movement.changedBy.id, name: movement.changedBy.name, role: movement.changedBy.role } : null,
});

router.get('/', async (req, res) => {
  try {
    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(req.query.variantId ? { variantId: String(req.query.variantId) } : {}),
        ...(req.query.productId ? { productId: String(req.query.productId) } : {}),
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true, unit: true } },
        changedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(req.query.limit) || 100, 1), 500),
    });
    return res.json({ success: true, movements: movements.map(serialize) });
  } catch (error) {
    console.error('Stock movement load failed:', error.message);
    return res.status(503).json({ success: false, message: 'Kartu stok belum dapat dimuat' });
  }
});

router.post('/adjust', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const variantId = String(req.body?.variantId || '');
  const reason = String(req.body?.reason || '').trim();
  const hasNewQty = req.body?.newQty !== undefined && req.body?.newQty !== '';
  const newQty = hasNewQty ? Number(req.body.newQty) : null;
  const delta = req.body?.delta === undefined ? null : Number(req.body.delta);
  if (!variantId || reason.length < 3 || (!hasNewQty && !Number.isFinite(delta)) || (hasNewQty && (!Number.isFinite(newQty) || newQty < 0))) {
    return res.status(400).json({ success: false, message: 'Produk, jumlah baru atau selisih, dan alasan wajib diisi' });
  }
  try {
    const movement = await prisma.$transaction(async (transaction) => {
      const variant = await transaction.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
      if (!variant) throw Object.assign(new Error('Varian tidak ditemukan'), { statusCode: 404 });
      const currentQty = Number(variant.stockQty);
      const targetQty = hasNewQty ? newQty : currentQty + delta;
      if (targetQty < 0) throw Object.assign(new Error('Stok akhir tidak boleh negatif'), { statusCode: 400 });
      const difference = targetQty - currentQty;
      await transaction.productVariant.update({ where: { id: variant.id }, data: { stockQty: targetQty } });
      const created = await transaction.stockMovement.create({
        data: { productId: variant.productId, variantId: variant.id, type: 'ADJUSTMENT', quantity: difference, note: reason, reference: 'MANUAL_ADJUSTMENT', changedById: req.user.id },
        include: { product: { select: { id: true, name: true, sku: true } }, variant: { select: { id: true, name: true, sku: true, unit: true } }, changedBy: { select: { id: true, name: true, role: true } } },
      });
      return { created, currentQty, targetQty };
    });
    await writeAuditLog({ entityType: 'StockMovement', entityId: movement.created.id, field: 'ADJUSTMENT', oldValue: { variantId, stockQty: movement.currentQty }, newValue: { stockQty: movement.targetQty, reason }, changedById: req.user.id });
    return res.status(201).json({ success: true, movement: serialize(movement.created) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Penyesuaian stok gagal disimpan' });
  }
});

export default router;
