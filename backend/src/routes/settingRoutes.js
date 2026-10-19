import express from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { getAppSettings, invalidateAppSettingsCache, updateAppSettings } from '../services/appSettingService.js';

const router = express.Router();
const storeProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(500),
  openingHours: z.string().trim().max(300),
}).strict();
const deliverySchema = z.object({
  enabled: z.boolean(),
  freeDistanceKm: z.number().min(0).max(100),
  ratePerKm: z.number().int().min(0).max(1_000_000),
  minimumSubtotal: z.number().int().min(0).max(100_000_000),
}).strict();
const checkoutSchema = z.object({
  paymentMethods: z.array(z.enum(['CASH', 'QRIS', 'TRANSFER', 'DEBT'])).min(1).max(4),
}).strict();
const cashierDiscountSchema = z.object({
  maxPercent: z.number().min(0).max(100),
  maxAmount: z.number().int().min(0).max(100_000_000),
}).strict();
const inventorySchema = z.object({
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  expiryWarningDays: z.number().int().min(0).max(3650),
}).strict();
const settingsSchema = z.object({
  settings: z.object({
    storeProfile: storeProfileSchema.optional(),
    delivery: deliverySchema.optional(),
    checkout: checkoutSchema.optional(),
    cashierDiscount: cashierDiscountSchema.optional(),
    inventory: inventorySchema.optional(),
  }).strict().refine((settings) => Object.keys(settings).length > 0, 'Pilih setidaknya satu pengaturan.'),
}).strict();

router.get('/public', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    const settings = await getAppSettings(prisma, { publicOnly: true });
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('Public settings lookup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Pengaturan toko sementara tidak tersedia.' });
  }
});

router.get('/', authenticateToken, requireRole('OWNER', 'ADMIN'), async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, settings: await getAppSettings() });
  } catch (error) {
    console.error('Settings lookup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Pengaturan toko sementara tidak tersedia.' });
  }
});

router.patch('/', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(settingsSchema), async (req, res) => {
  try {
    const updated = await updateAppSettings(prisma, { settings: req.body.settings, changedById: req.user.id });
    invalidateAppSettingsCache();
    return res.json({
      success: true,
      message: 'Pengaturan toko berhasil disimpan.',
      settings: { ...(await getAppSettings()), ...updated },
    });
  } catch (error) {
    console.error('Settings update failed:', error.message);
    return res.status(503).json({ success: false, message: 'Pengaturan toko gagal disimpan. Coba lagi.' });
  }
});

export default router;
