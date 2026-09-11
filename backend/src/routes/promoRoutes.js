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

function formatPromo(promo) {
  return {
    id: promo.id,
    name: promo.name,
    slug: promo.slug,
    description: promo.description || '',
    discountType: promo.discountType,
    discountValue: Number(promo.discountValue || 0),
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    isActive: promo.isActive,
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const { activeOnly } = req.query || {};
    const promos = await prisma.promoCampaign.findMany({
      where: activeOnly === 'true' ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, promos: promos.map(formatPromo) });
  } catch (error) {
    console.error('Promo list failed:', error.message);
    return res.status(500).json({ success: false, message: 'Promo gagal dimuat' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const promo = await prisma.promoCampaign.findUnique({ where: { id: req.params.id } });
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo tidak ditemukan' });
    }
    return res.json({ success: true, promo: formatPromo(promo) });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Promo gagal dimuat' });
  }
});

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { name, description = '', discountType = 'PERCENT', discountValue, startsAt, endsAt, isActive = true } = req.body || {};
    const trimmedName = String(name || '').trim();
    const slug = makeSlug(trimmedName);

    if (!trimmedName || !slug) {
      return res.status(400).json({ success: false, message: 'Nama promo wajib diisi' });
    }

    const promo = await prisma.promoCampaign.create({
      data: {
        name: trimmedName,
        slug,
        description: String(description).trim() || null,
        discountType: String(discountType).toUpperCase(),
        discountValue: Number(discountValue || 0),
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: Boolean(isActive),
      },
    });

    return res.status(201).json({ success: true, promo: formatPromo(promo) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.code === 'P2002' ? 'Slug promo sudah digunakan' : error.message || 'Promo gagal disimpan',
    });
  }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { name, description, discountType, discountValue, startsAt, endsAt, isActive } = req.body || {};
    const payload = {};

    if (name !== undefined) {
      const trimmedName = String(name || '').trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Nama promo wajib diisi' });
      }
      payload.name = trimmedName;
      payload.slug = makeSlug(trimmedName);
    }

    if (description !== undefined) payload.description = String(description).trim() || null;
    if (discountType !== undefined) payload.discountType = String(discountType).toUpperCase();
    if (discountValue !== undefined) payload.discountValue = Number(discountValue || 0);
    if (startsAt !== undefined) payload.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) payload.endsAt = endsAt ? new Date(endsAt) : null;
    if (isActive !== undefined) payload.isActive = Boolean(isActive);

    const promo = await prisma.promoCampaign.update({
      where: { id: req.params.id },
      data: payload,
    });

    return res.json({ success: true, promo: formatPromo(promo) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Promo tidak ditemukan' : error.message || 'Promo gagal diperbarui',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.promoCampaign.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Promo berhasil dihapus' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Promo tidak ditemukan' : 'Promo gagal dihapus',
    });
  }
});

export default router;
