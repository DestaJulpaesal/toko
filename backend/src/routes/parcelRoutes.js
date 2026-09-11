import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

function makeSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatParcel(parcel) {
  return {
    id: parcel.id,
    name: parcel.name,
    slug: parcel.slug,
    description: parcel.description || '',
    type: parcel.type,
    price: Number(parcel.price || 0),
    imageUrl: parcel.imageUrl || null,
    isActive: parcel.isActive,
    itemCount: parcel.items?.length || 0,
    items: (parcel.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || null,
      quantity: item.quantity,
      notes: item.notes || '',
    })),
    createdAt: parcel.createdAt,
    updatedAt: parcel.updatedAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const parcels = await prisma.parcel.findMany({
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, parcels: parcels.map(formatParcel) });
  } catch (error) {
    console.error('Parcel list failed:', error.message);
    return res.status(500).json({ success: false, message: 'Parcel gagal dimuat' });
  }
});

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { name, description = '', type = 'STANDARD', price, imageUrl, isActive = true, items = [] } = req.body || {};
    const trimmedName = String(name || '').trim();
    const normalizedPrice = Number(price || 0);
    const slug = makeSlug(trimmedName);

    if (!trimmedName || !slug) {
      return res.status(400).json({ success: false, message: 'Nama parcel wajib diisi' });
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Harga parcel tidak valid' });
    }

    const parcel = await prisma.parcel.create({
      data: {
        name: trimmedName,
        slug,
        description: String(description).trim() || null,
        type,
        price: normalizedPrice,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        isActive: Boolean(isActive),
        items: {
          create: Array.isArray(items)
            ? items.map((item) => ({
                productId: item.productId,
                quantity: Number(item.quantity || 1),
                notes: item.notes ? String(item.notes).trim() : null,
              }))
            : [],
        },
      },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });

    return res.status(201).json({ success: true, parcel: formatParcel(parcel) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.code === 'P2002' ? 'Slug parcel sudah digunakan' : error.message || 'Parcel gagal disimpan',
    });
  }
});

router.post('/custom', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  return router.handle({
    ...req,
    body: {
      ...req.body,
      type: 'CUSTOM',
    },
  }, res);
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { name, description = '', type = 'STANDARD', price, imageUrl, isActive = true, items = [] } = req.body || {};
    const trimmedName = String(name || '').trim();
    const normalizedPrice = Number(price || 0);
    const slug = makeSlug(trimmedName);

    if (!trimmedName || !slug) {
      return res.status(400).json({ success: false, message: 'Nama parcel wajib diisi' });
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Harga parcel tidak valid' });
    }

    const parcel = await prisma.parcel.update({
      where: { id: req.params.id },
      data: {
        name: trimmedName,
        slug,
        description: String(description).trim() || null,
        type,
        price: normalizedPrice,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        isActive: Boolean(isActive),
        items: {
          deleteMany: {},
          create: Array.isArray(items)
            ? items.map((item) => ({
                productId: item.productId,
                quantity: Number(item.quantity || 1),
                notes: item.notes ? String(item.notes).trim() : null,
              }))
            : [],
        },
      },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });

    return res.json({ success: true, parcel: formatParcel(parcel) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Parcel tidak ditemukan' : error.message || 'Parcel gagal diperbarui',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.parcel.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Parcel berhasil dihapus' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Parcel tidak ditemukan' : 'Parcel gagal dihapus',
    });
  }
});

export default router;
