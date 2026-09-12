import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, managerCreateSchema, managerUpdateSchema } from '../middleware/security.js';

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
      where: { role: { in: ['PARCEL_MANAGER', 'CASHIER'] }, isActive: true },
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
    const hashRows = await prisma.$queryRaw`SELECT crypt(${String(password)}, gen_salt('bf')) AS hash`;
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashRows[0].hash,
        phone: phone ? String(phone).trim() : null,
        role: regionId ? 'PARCEL_MANAGER' : 'CASHIER',
        regionId: regionId || null,
      },
      include: { region: { select: { name: true } } },
    });
    if (regionId) {
      await prisma.parcelRegion.update({ where: { id: regionId }, data: { managerId: user.id } });
    }
    return res.status(201).json({ success: true, manager: formatManager(user) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Email akun sudah digunakan.' : error.message || 'Akun manager gagal dibuat.' });
  }
});

router.patch('/:id', ...ownerOnly, validateBody(managerUpdateSchema), async (req, res) => {
  try {
    const { name, email, password, phone, regionId, isActive } = req.body || {};
    const current = await prisma.user.findUnique({ where: { id: req.params.id }, include: { region: true } });
    if (!current || !['PARCEL_MANAGER', 'CASHIER'].includes(current.role)) return res.status(404).json({ success: false, message: 'Akun operasional tidak ditemukan.' });
    const nextRegionId = regionId === undefined ? current.regionId : (regionId || null);
    const data = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(email !== undefined ? { email: String(email).trim().toLowerCase() } : {}),
      ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      regionId: nextRegionId,
      role: nextRegionId ? 'PARCEL_MANAGER' : 'CASHIER',
    };
    if (password) {
      const hashRows = await prisma.$queryRaw`SELECT crypt(${String(password)}, gen_salt('bf')) AS hash`;
      data.passwordHash = hashRows[0].hash;
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data, include: { region: { select: { name: true } } } });
    if (current.regionId && current.regionId !== nextRegionId) await prisma.parcelRegion.updateMany({ where: { id: current.regionId, managerId: current.id }, data: { managerId: null } });
    if (nextRegionId) await prisma.parcelRegion.update({ where: { id: nextRegionId }, data: { managerId: user.id } });
    return res.json({ success: true, manager: formatManager(user) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Email akun sudah digunakan.' : error.message || 'Akun gagal diperbarui.' });
  }
});

router.delete('/:id', ...ownerOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || !['PARCEL_MANAGER', 'CASHIER'].includes(user.role)) return res.status(404).json({ success: false, message: 'Akun operasional tidak ditemukan.' });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false, regionId: null, role: 'CASHIER' } });
    await prisma.parcelRegion.updateMany({ where: { managerId: user.id }, data: { managerId: null } });
    return res.json({ success: true, message: 'Akun berhasil dinonaktifkan.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Akun gagal dinonaktifkan.' });
  }
});

export default router;
