import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { accountUpdateSchema, validateBody } from '../middleware/security.js';
import { sessions } from '../services/sessionService.js';

const router = express.Router();
const ownerOnly = [authenticateToken, requireRole('OWNER')];
const accountFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  regionId: true,
  createdAt: true,
  emailVerifiedAt: true,
  region: { select: { name: true, isActive: true } },
  managedRegions: { select: { id: true, name: true, isActive: true } },
};

function formatAccount({ region, managedRegions, ...user }) {
  const assignedRegion = region || managedRegions?.[0] || null;
  return {
    ...user,
    phone: user.phone || '',
    regionId: user.regionId || assignedRegion?.id || null,
    regionName: assignedRegion?.name || null,
    regionIsActive: assignedRegion?.isActive ?? null,
  };
}

router.get('/', ...ownerOnly, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: accountFields,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return res.json({
      success: true,
      accounts: users.map(formatAccount),
    });
  } catch (error) {
    console.error('Account list failed:', error.message);
    return res.status(503).json({ success: false, message: 'Data akun belum bisa dimuat.' });
  }
});

router.patch('/:id', ...ownerOnly, validateBody(accountUpdateSchema), async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: req.params.id } });
      if (!current || current.role === 'OWNER') {
        const error = new Error('Akun owner hanya dapat mengubah sandinya sendiri.');
        error.status = 404;
        throw error;
      }
      if (current.id === req.user.id && (req.body.role !== undefined || req.body.isActive !== undefined || req.body.password)) {
        const error = new Error('Perubahan peran, status, atau sandi akun sendiri tidak diizinkan dari pengelolaan akun.');
        error.status = 400;
        throw error;
      }

      const managedRegion = current.role === 'PARCEL_MANAGER' && !current.regionId
        ? await tx.parcelRegion.findFirst({ where: { managerId: current.id } })
        : null;
      const currentRegionId = current.regionId || managedRegion?.id || null;
      const role = req.body.role ?? current.role;
      const isActive = req.body.isActive ?? current.isActive;
      const requestedRegionId = req.body.regionId === undefined ? currentRegionId : (req.body.regionId || null);
      const regionId = role === 'PARCEL_MANAGER' ? requestedRegionId : null;

      if (role === 'PARCEL_MANAGER' && !regionId) {
        const error = new Error('Pilih wilayah untuk akun manager parsel.');
        error.status = 400;
        throw error;
      }

      if (currentRegionId && (role !== 'PARCEL_MANAGER' || currentRegionId !== regionId || !isActive)) {
        await tx.parcelRegion.updateMany({
          where: { id: currentRegionId, managerId: current.id },
          data: { managerId: null },
        });
      }

      if (role === 'PARCEL_MANAGER') {
        const region = await tx.parcelRegion.findUnique({ where: { id: regionId } });
        if (!region || (!region.isActive && region.id !== currentRegionId)) {
          const error = new Error('Wilayah parsel tidak ditemukan atau sudah nonaktif.');
          error.status = 400;
          throw error;
        }
        if (isActive && region.managerId && region.managerId !== current.id) {
          const error = new Error('Wilayah tersebut sudah memiliki manager parsel.');
          error.status = 409;
          throw error;
        }
        if (isActive && region.isActive) {
          const assigned = await tx.parcelRegion.updateMany({
            where: { id: regionId, isActive: true, OR: [{ managerId: null }, { managerId: current.id }] },
            data: { managerId: current.id },
          });
          if (!assigned.count) {
            const error = new Error('Wilayah tersebut sudah memiliki manager parsel.');
            error.status = 409;
            throw error;
          }
        }
      }

      const passwordHash = req.body.password
        ? (await tx.$queryRaw`SELECT crypt(${req.body.password}, gen_salt('bf')) AS hash`)[0].hash
        : undefined;
      const revokeSessions = Boolean(
        req.body.password
        || current.role !== role
        || current.isActive !== isActive
        || (req.body.email !== undefined && current.email !== req.body.email)
      );

      const user = await tx.user.update({
        where: { id: current.id },
        data: {
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.email !== undefined ? { email: req.body.email } : {}),
          ...(req.body.phone !== undefined ? { phone: req.body.phone || null } : {}),
          role,
          regionId,
          isActive,
          ...(passwordHash ? { passwordHash } : {}),
          ...(revokeSessions ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: accountFields,
      });

      await tx.auditLog.create({
        data: {
          entityType: 'User',
          entityId: user.id,
          field: 'account',
          oldValue: JSON.stringify({ role: current.role, isActive: current.isActive, regionId: currentRegionId }),
          newValue: JSON.stringify({
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            regionId: user.regionId,
            passwordUpdated: Boolean(passwordHash),
          }),
          changedById: req.user.id,
        },
      });

      return user;
    });

    sessions.invalidate(result.id);
    return res.json({
      success: true,
      account: formatAccount(result),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Email tersebut sudah digunakan akun lain.' });
    }
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Account update failed:', error.message);
    return res.status(503).json({ success: false, message: 'Akun belum berhasil diperbarui.' });
  }
});

export default router;
