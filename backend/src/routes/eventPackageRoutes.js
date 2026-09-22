import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
<<<<<<< HEAD

const router = express.Router();
=======
import { createCatalogHandlers } from '../services/catalogHandlers.js';
import { formatEventPackage } from '../services/catalogSerializers.js';

const router = express.Router();
const catalog = createCatalogHandlers(prisma);
>>>>>>> cbd8857 (push fitur notifikasi email)

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

<<<<<<< HEAD
function formatPackage(item) {
  return {
    ...item,
    price: Number(item.price),
    items: item.items?.map((entry) => ({
      ...entry,
      variant: entry.variant ? { ...entry.variant, sellPrice: Number(entry.variant.sellPrice), stockQty: entry.variant.stockQty } : undefined,
    })),
  };
}

router.get('/', async (req, res) => {
  try {
    const packages = await prisma.eventPackage.findMany({
      where: { isActive: true },
      include: { items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, packages: packages.map(formatPackage) });
  } catch (error) {
    console.error('Event package list failed:', error.message);
    return res.status(503).json({ success: false, message: 'Daftar paket acara belum dapat dimuat.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.eventPackage.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }], isActive: true },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!item) return res.status(404).json({ success: false, message: 'Paket acara tidak ditemukan' });
    return res.json({ success: true, package: formatPackage(item) });
  } catch (error) {
    console.error('Event package detail failed:', error.message);
    return res.status(503).json({ success: false, message: 'Detail paket acara belum dapat dimuat.' });
  }
});
=======
// Publik. Isi respons di-whitelist (tanpa harga modal), lihat services/catalogHandlers.js.
router.get('/', catalog.listEventPackages);
router.get('/:id', catalog.getEventPackage);
>>>>>>> cbd8857 (push fitur notifikasi email)

async function createPackage(req, res, isCustom = false) {
  try {
    const { name, description, imageUrl, isManualPrice = false, price, items = [] } = req.body || {};
    if (!String(name || '').trim() || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Nama dan minimal satu isi paket wajib diisi' });
    }

  const variantIds = items.map((item) => String(item.variantId || ''));
  const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true } });
  if (variants.length !== variantIds.length) return res.status(400).json({ success: false, message: 'Ada varian paket yang tidak ditemukan' });

  const normalizedItems = items.map((item) => ({ variantId: String(item.variantId), quantity: Number(item.quantity) }));
  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return res.status(400).json({ success: false, message: 'Jumlah setiap item paket harus minimal 1' });
  }
  const calculatedPrice = normalizedItems.reduce((total, item) => {
    const variant = variants.find((candidate) => candidate.id === item.variantId);
    return total + Number(variant.sellPrice) * item.quantity;
  }, 0);

  const created = await prisma.eventPackage.create({
    data: {
      name: String(name).trim(),
      slug: `${slugify(name)}-${Date.now()}`,
      description: description ? String(description).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      price: isManualPrice ? Number(price) : calculatedPrice,
      isManualPrice: Boolean(isManualPrice),
      isCustom,
      items: { create: normalizedItems },
    },
    include: { items: { include: { variant: true } } },
  });
<<<<<<< HEAD
    return res.status(201).json({ success: true, package: formatPackage(created) });
=======
    return res.status(201).json({ success: true, package: formatEventPackage(created) });
>>>>>>> cbd8857 (push fitur notifikasi email)
  } catch (error) {
    console.error('Event package create failed:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Paket acara gagal disimpan.' });
  }
}

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => createPackage(req, res));
router.post('/custom', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => createPackage(req, res, true));

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { name, description, imageUrl, isManualPrice, price, items, isActive } = req.body || {};
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Nama paket wajib diisi' });
  }

  let normalizedItems;
  let variants = [];
  if (items !== undefined) {
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Minimal satu isi paket wajib diisi' });
    }
    normalizedItems = items.map((entry) => ({ variantId: String(entry.variantId || ''), quantity: Number(entry.quantity) }));
    if (normalizedItems.some((entry) => !entry.variantId || !Number.isInteger(entry.quantity) || entry.quantity < 1)) {
      return res.status(400).json({ success: false, message: 'Jumlah setiap item paket harus minimal 1' });
    }
    variants = await prisma.productVariant.findMany({ where: { id: { in: normalizedItems.map((entry) => entry.variantId) }, isActive: true } });
    if (variants.length !== normalizedItems.length) {
      return res.status(400).json({ success: false, message: 'Ada varian paket yang tidak ditemukan' });
    }
  }

  const existing = await prisma.eventPackage.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Paket acara tidak ditemukan' });
  const calculatedPrice = normalizedItems
    ? normalizedItems.reduce((total, entry) => total + Number(variants.find((variant) => variant.id === entry.variantId).sellPrice) * entry.quantity, 0)
    : undefined;
  const manual = isManualPrice !== undefined ? Boolean(isManualPrice) : existing.isManualPrice;
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.eventPackage.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ? String(imageUrl).trim() : null } : {}),
        ...(items !== undefined ? { price: manual ? Number(price) : calculatedPrice, isManualPrice: manual } : {}),
        ...(items === undefined && price !== undefined ? { price: Number(price), isManualPrice: true } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(items !== undefined ? { items: { deleteMany: {}, create: normalizedItems } } : {}),
      },
      include: { items: { include: { variant: true } } },
    });
    return updated;
  });
<<<<<<< HEAD
    return res.json({ success: true, package: formatPackage(item) });
=======
    return res.json({ success: true, package: formatEventPackage(item) });
>>>>>>> cbd8857 (push fitur notifikasi email)
  } catch (error) {
    console.error('Event package update failed:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Paket acara gagal diperbarui.' });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.eventPackage.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ success: true, message: 'Paket acara dinonaktifkan' });
  } catch (error) {
    console.error('Event package delete failed:', error.message);
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Paket acara gagal dinonaktifkan.' });
  }
});

export default router;
