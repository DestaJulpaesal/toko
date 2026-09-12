import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, parcelRegionCreateSchema, parcelRegionUpdateSchema } from '../middleware/security.js';

const router = express.Router();
const ownerOnly = [authenticateToken, requireRole('OWNER', 'ADMIN')];

function formatRegion(region) {
  const participants = region.participants || [];
  const targetAmount = participants.reduce((sum, item) => sum + Number(item.targetAmount || 0), 0);
  const paidAmount = participants.reduce((sum, item) => sum + (item.contributions || []).reduce((paid, row) => paid + Number(row.amount || 0), 0), 0);
  const managerCommission = participants.reduce((sum, item) => sum + Number(item.managerCommission || 0), 0);
  return {
    id: region.id,
    name: region.name,
    code: region.code,
    managerId: region.managerId,
    managerName: region.manager?.name || null,
    participantCount: region._count?.participants || 0,
    memberCount: region._count?.users || 0,
    targetAmount,
    paidAmount,
    managerCommission,
    progress: targetAmount > 0 ? Math.min(Math.round((paidAmount / targetAmount) * 100), 100) : 0,
    isActive: region.isActive,
  };
}

const includeData = {
  manager: { select: { id: true, name: true, email: true, role: true } },
  _count: { select: { participants: true, users: true } },
  participants: { select: { targetAmount: true, managerCommission: true, contributions: { select: { amount: true } } } },
};

router.get('/', ...ownerOnly, async (req, res) => {
  try {
    const regions = await prisma.parcelRegion.findMany({ include: includeData, orderBy: { name: 'asc' } });
    return res.json({ success: true, regions: regions.map(formatRegion) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Wilayah parsel gagal dimuat.' });
  }
});

router.post('/', ...ownerOnly, validateBody(parcelRegionCreateSchema), async (req, res) => {
  try {
    const { name, code, managerId } = req.body || {};
    const region = await prisma.parcelRegion.create({ data: { name: String(name).trim(), code: String(code).trim().toUpperCase(), managerId: managerId || null }, include: includeData });
    if (managerId) await prisma.user.update({ where: { id: managerId }, data: { role: 'PARCEL_MANAGER', regionId: region.id } });
    return res.status(201).json({ success: true, region: formatRegion(region) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Kode wilayah sudah digunakan.' : error.message || 'Wilayah gagal dibuat.' });
  }
});

router.patch('/:id', ...ownerOnly, validateBody(parcelRegionUpdateSchema), async (req, res) => {
  try {
    const { name, code, managerId, isActive } = req.body || {};
    const current = await prisma.parcelRegion.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ success: false, message: 'Wilayah tidak ditemukan.' });
    const region = await prisma.parcelRegion.update({ where: { id: req.params.id }, data: { ...(name !== undefined ? { name: String(name).trim() } : {}), ...(code !== undefined ? { code: String(code).trim().toUpperCase() } : {}), ...(managerId !== undefined ? { managerId: managerId || null } : {}), ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}) }, include: includeData });
    if (current.managerId && current.managerId !== managerId) await prisma.user.update({ where: { id: current.managerId }, data: { role: 'CASHIER', regionId: null } });
    if (managerId) await prisma.user.update({ where: { id: managerId }, data: { role: 'PARCEL_MANAGER', regionId: region.id } });
    return res.json({ success: true, region: formatRegion(region) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Wilayah gagal diperbarui.' });
  }
});

export default router;
