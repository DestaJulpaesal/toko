import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, categorySchema } from '../middleware/security.js';

const router = express.Router();

function makeSlug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatCategory(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    productCount: category._count?.products || 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, categories: categories.map(formatCategory) });
  } catch (error) {
    console.error('Category list failed:', error.message);
    return res.status(500).json({ success: false, message: 'Kategori gagal dimuat' });
  }
});

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(categorySchema), async (req, res) => {
  try {
    const { name, description = '' } = req.body || {};
    const trimmedName = String(name || '').trim();
    const slug = makeSlug(trimmedName);

    if (!trimmedName || !slug) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const category = await prisma.category.create({
      data: { name: trimmedName, slug, description: String(description).trim() || null },
      include: { _count: { select: { products: true } } },
    });
    return res.status(201).json({ success: true, category: formatCategory(category) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.code === 'P2002' ? 'Nama atau slug kategori sudah digunakan' : 'Kategori gagal disimpan',
    });
  }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(categorySchema), async (req, res) => {
  try {
    const { name, description = '' } = req.body || {};
    const trimmedName = String(name || '').trim();
    const slug = makeSlug(trimmedName);

    if (!trimmedName || !slug) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name: trimmedName, slug, description: String(description).trim() || null },
      include: { _count: { select: { products: true } } },
    });
    return res.json({ success: true, category: formatCategory(category) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2002' ? 'Nama atau slug kategori sudah digunakan' : error.code === 'P2025' ? 'Kategori tidak ditemukan' : 'Kategori gagal diperbarui',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    if (category._count.products > 0) {
      return res.status(409).json({ success: false, message: 'Kategori yang masih memiliki produk tidak dapat dihapus' });
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Kategori gagal dihapus' });
  }
});

export default router;
