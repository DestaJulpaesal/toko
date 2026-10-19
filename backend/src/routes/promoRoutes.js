import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, promoCreateSchema, promoUpdateSchema, promoValidationSchema } from '../middleware/security.js';
import { validatePromoCode } from '../services/promoService.js';
import { invalidateHomepageCache } from '../services/homepageHandler.js';

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
    code: promo.code || '',
    description: promo.description || '',
    discountType: promo.discountType,
    discountValue: Number(promo.discountValue || 0),
    minPurchase: promo.minPurchase == null ? null : Number(promo.minPurchase),
    maxDiscount: promo.maxDiscount == null ? null : Number(promo.maxDiscount),
    usageLimit: promo.usageLimit,
    usedCount: promo.usedCount,
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
    if (activeOnly === 'true') res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    const now = new Date();
    const promos = await prisma.promoCampaign.findMany({
      where: activeOnly === 'true'
        ? {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        }
        : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        discountType: true,
        discountValue: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      success: true,
      promos: promos
        .map((promo) => ({ ...promo, code: '', minPurchase: null, maxDiscount: null, usageLimit: null, usedCount: 0 }))
        .map(formatPromo),
    });
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

router.post('/validate', validateBody(promoValidationSchema), async (req, res) => {
  try {
    const result = await validatePromoCode(prisma, req.body.code, req.body.subtotal);
    return res.json({
      success: true,
      promo: formatPromo(result.promo),
      discountAmount: result.discountAmount,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Kode promo tidak dapat digunakan.' });
  }
});

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(promoCreateSchema), async (req, res) => {
  try {
    const { name, code, description = '', discountType = 'PERCENT', discountValue, minPurchase, maxDiscount, usageLimit, startsAt, endsAt, isActive = true } = req.body || {};
    const trimmedName = String(name || '').trim();
    const slug = makeSlug(trimmedName);

    if (!trimmedName || !slug) {
      return res.status(400).json({ success: false, message: 'Nama promo wajib diisi' });
    }

    const promo = await prisma.promoCampaign.create({
      data: {
        name: trimmedName,
        slug,
        code: code ? String(code).trim().toUpperCase() : null,
        description: String(description).trim() || null,
        discountType: String(discountType).toUpperCase(),
        discountValue: Number(discountValue || 0),
        minPurchase: minPurchase == null ? null : Number(minPurchase),
        maxDiscount: maxDiscount == null ? null : Number(maxDiscount),
        usageLimit: usageLimit == null ? null : Number(usageLimit),
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: Boolean(isActive),
      },
    });

    invalidateHomepageCache(prisma);
    return res.status(201).json({ success: true, promo: formatPromo(promo) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.code === 'P2002' ? 'Kode atau nama promo sudah digunakan' : error.message || 'Promo gagal disimpan',
    });
  }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(promoUpdateSchema), async (req, res) => {
  try {
    const { name, code, description, discountType, discountValue, minPurchase, maxDiscount, usageLimit, startsAt, endsAt, isActive } = req.body || {};
    const payload = {};

    if (name !== undefined) {
      const trimmedName = String(name || '').trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Nama promo wajib diisi' });
      }
      payload.name = trimmedName;
      payload.slug = makeSlug(trimmedName);
    }

    if (code !== undefined) payload.code = code ? String(code).trim().toUpperCase() : null;
    if (description !== undefined) payload.description = String(description).trim() || null;
    if (discountType !== undefined) payload.discountType = String(discountType).toUpperCase();
    if (discountValue !== undefined) payload.discountValue = Number(discountValue || 0);
    if (minPurchase !== undefined) payload.minPurchase = minPurchase == null ? null : Number(minPurchase);
    if (maxDiscount !== undefined) payload.maxDiscount = maxDiscount == null ? null : Number(maxDiscount);
    if (usageLimit !== undefined) payload.usageLimit = usageLimit == null ? null : Number(usageLimit);
    if (startsAt !== undefined) payload.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) payload.endsAt = endsAt ? new Date(endsAt) : null;
    if (isActive !== undefined) payload.isActive = Boolean(isActive);

    const promo = await prisma.promoCampaign.update({
      where: { id: req.params.id },
      data: payload,
    });

    invalidateHomepageCache(prisma);
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
    invalidateHomepageCache(prisma);
    return res.json({ success: true, message: 'Promo berhasil dihapus' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Promo tidak ditemukan' : 'Promo gagal dihapus',
    });
  }
});

export default router;
