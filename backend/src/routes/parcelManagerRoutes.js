import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, managerCreateSchema, managerUpdateSchema } from '../middleware/security.js';
import { sessions } from '../services/sessionService.js';

const router = express.Router();
const ownerOnly = [authenticateToken, requireRole('OWNER', 'ADMIN')];

function formatManager(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    isActive: user.isActive,
    regionId: user.regionId || null,
    regionName: user.region?.name || null,
  };
}

router.get('/', ...ownerOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'PARCEL_MANAGER', isActive: true },
      include: { region: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, managers: users.map(formatManager) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Akun manager gagal dimuat.' });
  }
});

router.post('/', ...ownerOnly, validateBody(managerCreateSchema), async (req, res) => {
  try {
    const { name, email, password, phone, regionId } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.$transaction(async (tx) => {
      const region = await tx.parcelRegion.findUnique({ where: { id: regionId } });
      if (!region || !region.isActive || region.managerId) {
        const error = new Error('Wilayah tidak tersedia atau sudah memiliki manager.');
        error.status = 409;
        throw error;
      }
      const hashRows = await tx.$queryRaw`SELECT crypt(${String(password)}, gen_salt('bf')) AS hash`;
      const manager = await tx.user.create({
        data: {
          name: String(name).trim(),
          email: normalizedEmail,
          passwordHash: hashRows[0].hash,
          phone: phone ? String(phone).trim() : null,
          role: 'PARCEL_MANAGER',
          regionId,
        },
      });
      const assigned = await tx.parcelRegion.updateMany({
        where: { id: regionId, isActive: true, managerId: null },
        data: { managerId: manager.id },
      });
      if (!assigned.count) {
        const error = new Error('Wilayah tidak tersedia atau sudah memiliki manager.');
        error.status = 409;
        throw error;
      }
      return tx.user.findUnique({ where: { id: manager.id }, include: { region: { select: { name: true } } } });
    });
    return res.status(201).json({ success: true, manager: formatManager(user) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Email akun sudah digunakan.' : error.message || 'Akun manager gagal dibuat.' });
  }
});

router.patch('/:id', ...ownerOnly, validateBody(managerUpdateSchema), async (req, res) => {
  try {
    const { name, email, password, phone, regionId, isActive } = req.body || {};
    const current = await prisma.user.findUnique({ where: { id: req.params.id }, include: { region: true } });
    if (!current || current.role !== 'PARCEL_MANAGER') return res.status(404).json({ success: false, message: 'Akun manager parsel tidak ditemukan.' });
    const nextRegionId = regionId === undefined ? current.regionId : (regionId || null);
    if (!nextRegionId) return res.status(400).json({ success: false, message: 'Wilayah manager wajib dipilih.' });
    const nextIsActive = isActive === undefined ? current.isActive : Boolean(isActive);
    const targetRegion = await prisma.parcelRegion.findUnique({ where: { id: nextRegionId } });
    if (!targetRegion || !targetRegion.isActive || (targetRegion.managerId && targetRegion.managerId !== current.id)) {
      return res.status(409).json({ success: false, message: 'Wilayah tidak tersedia atau sudah memiliki manager.' });
    }
    const data = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(email !== undefined ? { email: String(email).trim().toLowerCase() } : {}),
      ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
      ...(isActive !== undefined ? { isActive: nextIsActive } : {}),
      regionId: nextIsActive ? nextRegionId : null,
      role: 'PARCEL_MANAGER',
    };
    if (password) {
      const hashRows = await prisma.$queryRaw`SELECT crypt(${String(password)}, gen_salt('bf')) AS hash`;
      data.passwordHash = hashRows[0].hash;
      data.tokenVersion = { increment: 1 }; // password diganti admin: sesi lama akun itu dicabut
    }
    const user = await prisma.$transaction(async (tx) => {
      if (current.regionId && (current.regionId !== nextRegionId || !nextIsActive)) {
        await tx.parcelRegion.updateMany({ where: { id: current.regionId, managerId: current.id }, data: { managerId: null } });
      }
      const updated = await tx.user.update({ where: { id: req.params.id }, data, include: { region: { select: { name: true } } } });
      if (nextIsActive) {
        const assigned = await tx.parcelRegion.updateMany({
          where: { id: nextRegionId, isActive: true, OR: [{ managerId: null }, { managerId: updated.id }] },
          data: { managerId: updated.id },
        });
        if (!assigned.count) {
          const error = new Error('Wilayah tidak tersedia atau sudah memiliki manager.');
          error.status = 409;
          throw error;
        }
      }
      return updated;
    });
    sessions.invalidate(user.id);
    return res.json({ success: true, manager: formatManager(user) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Email akun sudah digunakan.' : error.message || 'Akun gagal diperbarui.' });
  }
});

router.delete('/:id', ...ownerOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'PARCEL_MANAGER') return res.status(404).json({ success: false, message: 'Akun manager parsel tidak ditemukan.' });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false, regionId: null } });
    sessions.invalidate(user.id); // langsung tidak bisa dipakai, tanpa menunggu cache sesi habis
    await prisma.parcelRegion.updateMany({ where: { managerId: user.id }, data: { managerId: null } });
    return res.json({ success: true, message: 'Akun berhasil dinonaktifkan.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Akun gagal dinonaktifkan.' });
  }
});

export default router;
