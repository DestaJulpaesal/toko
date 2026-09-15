import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));

function categoryWhere(category) {
  const value = String(category || '').trim();
  return value && value !== 'Semua' ? { category: { name: value } } : {};
}

function serializeItem(item) {
  return {
    id: item.id,
    variantId: item.variantId,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    category: item.categoryName,
    unit: item.unit,
    stockQty: item.stockQty,
    stockWarning: item.stockWarning,
    suggestedQty: item.suggestedQty,
    requestedQty: item.requestedQty,
    purchaseUnit: item.purchaseUnit || item.unit,
    purchasePrice: item.purchasePrice == null ? null : Number(item.purchasePrice),
    status: item.status,
  };
}

router.get('/', async (req, res) => {
  try {
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true, stockQty: { lte: 999999 }, product: categoryWhere(req.query.category) },
      include: { product: { select: { name: true, sku: true, stockWarning: true, category: { select: { name: true } } } } },
      orderBy: [{ product: { name: 'asc' } }, { stockQty: 'asc' }],
    });
    const latestList = await prisma.restockList.findFirst({
      where: { status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    const items = variants.map((variant) => {
      const saved = latestList?.items.find((item) => item.variantId === variant.id);
      return {
        id: saved?.id || null,
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        sku: variant.sku || variant.product.sku,
        category: variant.product.category?.name || 'Glosir',
        unit: variant.unit,
        stockQty: variant.stockQty,
        stockWarning: variant.product.stockWarning,
        suggestedQty: Math.max(variant.product.stockWarning * 2 - variant.stockQty, 0),
        requestedQty: saved?.requestedQty || 0,
        purchaseUnit: saved?.purchaseUnit || variant.unit || 'unit',
        purchasePrice: saved?.purchasePrice == null ? Number(variant.basePrice || 0) : Number(saved.purchasePrice),
        status: saved?.status || 'OPEN',
      };
    });
    return res.json({ success: true, listId: latestList?.id || null, items });
  } catch (error) {
    console.error('Restock list query failed:', error.message);
    return res.status(503).json({ success: false, message: 'Daftar restock belum dapat dimuat' });
  }
});

router.post('/', async (req, res) => {
  const { notes, items } = req.body || {};
  try {
    const source = Array.isArray(items) && items.length
      ? items
      : (await prisma.productVariant.findMany({
        where: { isActive: true },
        include: { product: { include: { category: true } } },
      }));
    if (!source.length) return res.status(400).json({ success: false, message: 'Tidak ada produk dengan stok menipis' });
    const list = await prisma.restockList.create({
      data: {
        notes: notes ? String(notes).trim() : null,
        createdById: req.user.id,
        items: { create: source.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || item.id,
          productName: item.productName || item.product?.name || 'Produk',
          sku: item.sku || item.product?.sku || '',
          categoryName: item.category || item.product?.category?.name || 'Glosir',
          unit: item.unit || 'unit',
          stockQty: Number(item.stockQty ?? 0),
          stockWarning: Number(item.stockWarning || item.product?.stockWarning || 0),
          suggestedQty: Number(item.suggestedQty || 0),
          requestedQty: Number(item.requestedQty ?? 0),
            purchaseUnit: String(item.purchaseUnit || item.unit || 'unit'),
            purchasePrice: item.purchasePrice == null ? null : Number(item.purchasePrice),
        })) },
      },
      include: { items: true },
    });
    return res.status(201).json({ success: true, list: { id: list.id, status: list.status, items: list.items.map(serializeItem) } });
  } catch (error) {
    console.error('Restock list create failed:', error);
    return res.status(400).json({ success: false, message: error.message || 'Daftar restock gagal disimpan' });
  }
});

router.patch('/items/:id', async (req, res) => {
  const data = {};
  if (req.body?.requestedQty !== undefined) data.requestedQty = Math.max(Number(req.body.requestedQty) || 0, 0);
  if (req.body?.purchaseUnit !== undefined) data.purchaseUnit = String(req.body.purchaseUnit).trim() || 'unit';
  if (req.body?.status) data.status = String(req.body.status).toUpperCase();
  if (!Object.keys(data).length) return res.status(400).json({ success: false, message: 'Perubahan item tidak ditemukan' });
  try {
    const item = await prisma.restockItem.update({ where: { id: req.params.id }, data });
    return res.json({ success: true, item: serializeItem(item) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Item restock tidak ditemukan' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const list = await prisma.restockList.update({
      where: { id: req.params.id },
      data: { ...(req.body?.status ? { status: String(req.body.status).toUpperCase() } : {}), ...(req.body?.notes !== undefined ? { notes: String(req.body.notes || '').trim() || null } : {}) },
    });
    return res.json({ success: true, list });
  } catch (error) {
    return res.status(404).json({ success: false, message: 'Daftar restock tidak ditemukan' });
  }
});

export default router;
