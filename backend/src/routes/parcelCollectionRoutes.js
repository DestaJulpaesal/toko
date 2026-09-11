import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const ownerRoles = ['OWNER', 'ADMIN'];
const allowedRoles = [authenticateToken, requireRole('OWNER', 'ADMIN', 'PARCEL_MANAGER')];

const includeData = {
  region: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, name: true } },
  entries: {
    orderBy: { createdAt: 'asc' },
    include: { participant: { select: { id: true, name: true, participantPhone: true, targetAmount: true } } },
  },
};

function formatSession(session) {
  const expectedAmount = Number(session.expectedAmount || 0);
  const actualCash = session.actualCash == null ? null : Number(session.actualCash);
  return {
    id: session.id,
    regionId: session.regionId,
    regionName: session.region?.name || null,
    regionCode: session.region?.code || null,
    managerId: session.managerId,
    managerName: session.manager?.name || null,
    collectionDate: session.collectionDate,
    status: session.status,
    expectedAmount,
    actualCash,
    difference: actualCash == null ? null : actualCash - expectedAmount,
    note: session.note || '',
    verifiedAt: session.verifiedAt,
    entries: (session.entries || []).map((entry) => ({
      id: entry.id,
      participantId: entry.participantId,
      participantName: entry.participant?.name || 'Peserta',
      participantPhone: entry.participant?.participantPhone || null,
      amount: Number(entry.amount || 0),
      note: entry.note || '',
    })),
  };
}

async function ensureRegionAccess(req, regionId) {
  const region = await prisma.parcelRegion.findUnique({ where: { id: String(regionId) } });
  if (!region) return { error: 'Wilayah tidak ditemukan.', status: 404 };
  if (req.user.role === 'PARCEL_MANAGER' && region.id !== req.user.regionId) return { error: 'Wilayah ini bukan tanggung jawab Anda.', status: 403 };
  return { region };
}

router.get('/', ...allowedRoles, async (req, res) => {
  try {
    const where = req.user.role === 'PARCEL_MANAGER' ? { regionId: req.user.regionId || '__none__' } : {};
    const sessions = await prisma.collectionSession.findMany({ where, include: includeData, orderBy: [{ collectionDate: 'desc' }, { createdAt: 'desc' }] });
    return res.json({ success: true, sessions: sessions.map(formatSession) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Rekap penagihan gagal dimuat.' });
  }
});

router.post('/', ...allowedRoles, async (req, res) => {
  try {
    const { regionId, collectionDate, entries = [], note } = req.body || {};
    if (!regionId || !Array.isArray(entries) || !entries.length) return res.status(400).json({ success: false, message: 'Wilayah dan minimal satu setoran peserta wajib diisi.' });
    const access = await ensureRegionAccess(req, regionId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    const cleanEntries = entries.filter((entry) => Number(entry.amount) > 0 && entry.participantId).map((entry) => ({ participantId: String(entry.participantId), amount: Number(entry.amount), note: entry.note ? String(entry.note).trim() : null }));
    if (!cleanEntries.length) return res.status(400).json({ success: false, message: 'Isi minimal satu nominal setoran peserta.' });
    const participants = await prisma.parcelParticipant.findMany({ where: { id: { in: cleanEntries.map((entry) => entry.participantId) }, regionId: String(regionId) }, select: { id: true } });
    const allowedParticipantIds = new Set(participants.map((participant) => participant.id));
    if (cleanEntries.some((entry) => !allowedParticipantIds.has(entry.participantId))) return res.status(400).json({ success: false, message: 'Ada peserta yang bukan bagian dari wilayah ini.' });
    const expectedAmount = cleanEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const session = await prisma.$transaction(async (transaction) => {
      const created = await transaction.collectionSession.create({ data: { regionId: String(regionId), managerId: req.user.id, collectionDate: collectionDate ? new Date(collectionDate) : new Date(), expectedAmount, note: note ? String(note).trim() : null, entries: { create: cleanEntries } } });
      for (const entry of cleanEntries) {
        await transaction.parcelContribution.create({ data: { participantId: entry.participantId, amount: entry.amount, paidAt: collectionDate ? new Date(collectionDate) : new Date(), note: `Penagihan wilayah ${access.region.name}${entry.note ? `: ${entry.note}` : ''}` } });
      }
      return transaction.collectionSession.findUnique({ where: { id: created.id }, include: includeData });
    });
    return res.status(201).json({ success: true, session: formatSession(session) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Rekap penagihan gagal disimpan.' });
  }
});

router.patch('/:id/verify', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const actualCash = Number(req.body?.actualCash);
    if (!Number.isFinite(actualCash) || actualCash < 0) return res.status(400).json({ success: false, message: 'Nominal cash diterima tidak valid.' });
    const current = await prisma.collectionSession.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ success: false, message: 'Rekap penagihan tidak ditemukan.' });
    const updated = await prisma.collectionSession.update({ where: { id: req.params.id }, data: { actualCash, difference: actualCash - Number(current.expectedAmount), status: 'VERIFIED', verifiedAt: new Date(), verifiedById: req.user.id, note: req.body?.note ? String(req.body.note).trim() : current.note }, include: includeData });
    return res.json({ success: true, session: formatSession(updated) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Serah terima gagal disimpan.' });
  }
});

export default router;
