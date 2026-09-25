import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { z } from 'zod';
import { calculateStockDecrease, validateStock } from '../utils/stockCalculation.js';

const router = express.Router();

/**
 * FASE 3: ProductUnit Management Endpoints
 * Handle satuan bervariasi & stok pecahan
 */

// Schema validation
const productUnitSchema = z.object({
  name: z.string().min(1, 'Nama satuan wajib diisi'),
  sku: z.string().min(1, 'SKU wajib diisi'),
  barcode: z.string().optional(),
  sellPrice: z.coerce.number().positive('Harga jual harus positif'),
  wholesalePrice: z.coerce.number().positive().optional(),
  conversionToBase: z.coerce.number().positive('Konversi harus positif'),
  isSellable: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// GET /api/products/:productId/units - Get all units for product
router.get('/:productId/units', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { units: { where: { isActive: true }, orderBy: { conversionToBase: 'desc' } } },
    });

    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    return res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        baseUnit: product.baseUnit,
        baseStockQty: Number(product.baseStockQty),
      },
      units: product.units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        sku: unit.sku,
        barcode: unit.barcode,
        sellPrice: Number(unit.sellPrice),
        wholesalePrice: Number(unit.wholesalePrice),
        conversionToBase: Number(unit.conversionToBase),
        isSellable: unit.isSellable,
        isDefault: unit.isDefault,
        isActive: unit.isActive,
      })),
    });
  } catch (error) {
    console.error('Get units error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil satuan' });
  }
});

// POST /api/products/:productId/units - Create unit
router.post('/:productId/units', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(productUnitSchema), async (req, res) => {
  try {
    const { productId } = req.params;

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    // TODO: Check SKU uniqueness across system
    // TODO: Check barcode uniqueness if provided

    const unit = await prisma.productUnit.create({
      data: {
        productId,
        ...req.body,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Satuan berhasil ditambahkan',
      unit: {
        id: unit.id,
        name: unit.name,
        sku: unit.sku,
        conversionToBase: Number(unit.conversionToBase),
        sellPrice: Number(unit.sellPrice),
      },
    });
  } catch (error) {
    console.error('Create unit error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'SKU atau barcode sudah digunakan' });
    }
    return res.status(500).json({ success: false, message: 'Gagal membuat satuan' });
  }
});

// PATCH /api/products/:productId/units/:unitId - Update unit
router.patch('/:productId/units/:unitId', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(productUnitSchema.partial()), async (req, res) => {
  try {
    const { productId, unitId } = req.params;

    // Verify product & unit exist
    const unit = await prisma.productUnit.findFirst({
      where: { id: unitId, productId },
    });

    if (!unit) return res.status(404).json({ success: false, message: 'Satuan tidak ditemukan' });

    // TODO: Handle SKU/barcode uniqueness update

    const updated = await prisma.productUnit.update({
      where: { id: unitId },
      data: req.body,
    });

    return res.json({
      success: true,
      message: 'Satuan berhasil diperbarui',
      unit: {
        id: updated.id,
        name: updated.name,
        sellPrice: Number(updated.sellPrice),
        conversionToBase: Number(updated.conversionToBase),
      },
    });
  } catch (error) {
    console.error('Update unit error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui satuan' });
  }
});

// DELETE /api/products/:productId/units/:unitId - Soft delete unit
router.delete('/:productId/units/:unitId', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { productId, unitId } = req.params;

    const unit = await prisma.productUnit.findFirst({
      where: { id: unitId, productId },
    });

    if (!unit) return res.status(404).json({ success: false, message: 'Satuan tidak ditemukan' });

    // TODO: Check if unit used in recent orders, prevent delete

    await prisma.productUnit.update({
      where: { id: unitId },
      data: { isActive: false },
    });

    return res.json({ success: true, message: 'Satuan berhasil dihapus' });
  } catch (error) {
    console.error('Delete unit error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus satuan' });
  }
});

// PUT /api/products/:productId/base-stock - Update central stock quantity
router.put('/:productId/base-stock', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(z.object({
  baseStockQty: z.coerce.number().nonnegative('Stok harus non-negatif'),
  note: z.string().optional(),
})), async (req, res) => {
  try {
    const { productId } = req.params;
    const { baseStockQty, note } = req.body;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });

    // TODO: Create stock movement record for audit

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { baseStockQty },
    });

    return res.json({
      success: true,
      message: 'Stok dasar berhasil diperbarui',
      baseStockQty: Number(updated.baseStockQty),
    });
  } catch (error) {
    console.error('Update base stock error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui stok' });
  }
});

// GET /api/products/:productId/validate-stock - Validate stock available for order
router.get('/:productId/validate-stock', async (req, res) => {
  try {
    const { productId } = req.params;
    const { unitId, quantity } = req.query;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { units: { where: { id: String(unitId) } } },
    });

    if (!product || product.units.length === 0) {
      return res.status(404).json({ success: false, message: 'Produk atau satuan tidak ditemukan' });
    }

    const unit = product.units[0];
    const qty = parseFloat(quantity);

    const stockDecrease = calculateStockDecrease(qty, unit.conversionToBase);
    const validation = validateStock(product.baseStockQty, qty, unit.conversionToBase);

    return res.json({
      success: true,
      isValid: validation.isValid,
      message: validation.message,
      available: Number(product.baseStockQty),
      required: stockDecrease,
      remaining: Math.max(0, Number(product.baseStockQty) - stockDecrease),
    });
  } catch (error) {
    console.error('Validate stock error:', error);
    return res.status(500).json({ success: false, message: 'Gagal validasi stok' });
  }
});

export default router;
