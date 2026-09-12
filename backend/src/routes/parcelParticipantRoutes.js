import express from 'express';
import prisma from '../config/db.js';
import { optionalAuth } from '../middleware/auth.js';
import { validateBody, parcelParticipantCreateSchema, parcelParticipantUpdateSchema, parcelContributionSchema } from '../middleware/security.js';

const router = express.Router();

function formatParticipant(item) {
  const paid = (item.contributions || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const targetAmount = Number(item.targetAmount || 0);
  const contributionAmount = Number(item.contributionAmount || 0);
  const paidInstallments = contributionAmount > 0 ? Math.floor(paid / contributionAmount) : 0;
  const installmentCount = contributionAmount > 0 ? Math.ceil(targetAmount / contributionAmount) : 0;
  const nextDueDate = new Date(item.startDate || item.createdAt || new Date());
  const periodDays = item.frequency === 'WEEKLY' ? 7 : 1;
  nextDueDate.setDate(nextDueDate.getDate() + paidInstallments * periodDays);
  const today = new Date();
  const overduePeriods = item.status === 'COMPLETED' || paid >= targetAmount || nextDueDate > today
    ? 0
    : Math.max(0, Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24 * periodDays)) + 1);
  const collectionStatus = paid >= targetAmount ? 'COMPLETED' : overduePeriods > 0 ? 'OVERDUE' : 'DUE';
  return {
    id: item.id,
    customerId: item.customerId,
    customerName: item.customer?.name || item.name,
    customerPhone: item.customer?.phone || item.participantPhone || null,
    parcelId: item.parcelId,
    parcelName: item.parcel?.name || null,
    programId: item.programId,
    programName: item.program?.name || null,
    regionId: item.regionId,
    regionName: item.region?.name || null,
    name: item.name,
    targetAmount,
    contributionAmount,
    salePrice: Number(item.salePrice || 0),
    grossMargin: Number(item.grossMargin || 0),
    managerCommission: Number(item.managerCommission || 0),
    commissionStatus: item.commissionStatus,
    frequency: item.frequency,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status,
    notes: item.notes || '',
    paidAmount: paid,
    remainingAmount: Math.max(Number(item.targetAmount || 0) - paid, 0),
    progress: targetAmount > 0 ? Math.min(Math.round((paid / targetAmount) * 100), 100) : 0,
    installmentCount,
    paidInstallments,
    nextDueDate: nextDueDate.toISOString(),
    overduePeriods,
    collectionStatus,
    contributions: (item.contributions || []).map((row) => ({ id: row.id, amount: Number(row.amount || 0), paidAt: row.paidAt, note: row.note || '' })),
  };
}

const includeData = {
  customer: { select: { id: true, name: true, phone: true } },
  parcel: { select: { id: true, name: true } },
  program: { select: { id: true, name: true, year: true } },
  region: { select: { id: true, name: true, code: true } },
  contributions: { orderBy: { paidAt: 'desc' } },
};

router.get('/', optionalAuth, async (req, res) => {
  try {
    const where = req.query.status ? { status: String(req.query.status).toUpperCase() } : {};
    if (req.user?.role === 'PARCEL_MANAGER') where.regionId = req.user.regionId || '__unassigned__';
    const rows = await prisma.parcelParticipant.findMany({ where, include: includeData, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, participants: rows.map(formatParticipant) });
  } catch (error) { return res.status(500).json({ success: false, message: error.message || 'Peserta parsel gagal dimuat.' }); }
});

router.post('/', optionalAuth, validateBody(parcelParticipantCreateSchema), async (req, res) => {
  try {
    const { customerId, participantPhone, participantName, parcelId, programId, name, targetAmount, contributionAmount, frequency = 'DAILY', startDate, endDate, notes } = req.body || {};
    const isManager = req.user?.role === 'PARCEL_MANAGER';
    const participantDisplayName = String(participantName || name || '').trim();
    if (!participantDisplayName || !programId || Number(contributionAmount) <= 0) return res.status(400).json({ success: false, message: 'Nama peserta, program, dan nominal setoran wajib diisi.' });
    const program = await prisma.parcelProgram.findUnique({ where: { id: String(programId) }, select: { name: true, targetAmount: true } });
    if (!program) return res.status(400).json({ success: false, message: 'Program tahunan tidak ditemukan.' });
    const officialTargetAmount = Number(program.targetAmount || 0);
    const regionId = req.user?.role === 'PARCEL_MANAGER' ? req.user.regionId || null : (req.body?.regionId || null);
    const created = await prisma.parcelParticipant.create({ data: { customerId: customerId ? String(customerId) : null, participantPhone: participantPhone ? String(participantPhone).trim() : null, parcelId: parcelId || null, programId: programId || null, regionId, name: participantDisplayName, targetAmount: officialTargetAmount, salePrice: Number(req.body?.salePrice || 0), grossMargin: Number(req.body?.grossMargin || 0), managerCommission: Number(req.body?.managerCommission || 0), contributionAmount: Number(contributionAmount), frequency: String(frequency).toUpperCase(), startDate: startDate ? new Date(startDate) : new Date(), endDate: endDate ? new Date(endDate) : null, notes: notes ? String(notes).trim() : null }, include: includeData });
    return res.status(201).json({ success: true, participant: formatParticipant(created) });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Peserta parsel gagal dibuat.' }); }
});

router.patch('/:id', optionalAuth, validateBody(parcelParticipantUpdateSchema), async (req, res) => {
  try {
    const { customerId, participantName, participantPhone, parcelId, programId, name, targetAmount, contributionAmount, frequency, startDate, endDate, status, notes } = req.body || {};
    const existing = await prisma.parcelParticipant.findUnique({ where: { id: req.params.id } });
    if (req.user?.role === 'PARCEL_MANAGER' && existing?.regionId !== req.user.regionId) return res.status(403).json({ success: false, message: 'Peserta ini bukan bagian dari wilayah Anda.' });
    const program = programId ? await prisma.parcelProgram.findUnique({ where: { id: String(programId) }, select: { name: true, targetAmount: true } }) : null;
    const updated = await prisma.parcelParticipant.update({ where: { id: req.params.id }, data: { ...(customerId !== undefined ? { customerId: customerId ? String(customerId) : null } : {}), ...(participantPhone !== undefined ? { participantPhone: participantPhone ? String(participantPhone).trim() : null } : {}), parcelId: parcelId || null, programId: programId || null, ...(participantName !== undefined || name !== undefined ? { name: String(participantName || name || '').trim() } : {}), ...(program?.targetAmount !== undefined ? { targetAmount: Number(program.targetAmount) } : targetAmount !== undefined ? { targetAmount: Number(targetAmount) } : {}), ...(contributionAmount !== undefined ? { contributionAmount: Number(contributionAmount) } : {}), ...(frequency ? { frequency: String(frequency).toUpperCase() } : {}), ...(startDate ? { startDate: new Date(startDate) } : {}), endDate: endDate ? new Date(endDate) : null, ...(status ? { status: String(status).toUpperCase() } : {}), notes: notes ? String(notes).trim() : null }, include: includeData });
    return res.json({ success: true, participant: formatParticipant(updated) });
  } catch (error) { return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: error.message || 'Peserta parsel gagal diperbarui.' }); }
});

router.post('/:id/contributions', optionalAuth, validateBody(parcelContributionSchema), async (req, res) => {
  try {
    const participant = await prisma.parcelParticipant.findUnique({ where: { id: req.params.id } });
    if (!participant) return res.status(404).json({ success: false, message: 'Peserta parsel tidak ditemukan.' });
    if (req.user?.role === 'PARCEL_MANAGER' && participant.regionId !== req.user.regionId) return res.status(403).json({ success: false, message: 'Peserta ini bukan bagian dari wilayah Anda.' });
    const amount = Number(req.body?.amount || participant.contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Nominal setoran tidak valid.' });
    const contribution = await prisma.parcelContribution.create({ data: { participantId: participant.id, amount, paidAt: req.body?.paidAt ? new Date(req.body.paidAt) : new Date(), note: req.body?.note ? String(req.body.note).trim() : null } });
    const updated = await prisma.parcelParticipant.findUnique({ where: { id: participant.id }, include: includeData });
    const paidAfterContribution = (updated.contributions || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (paidAfterContribution >= Number(updated.targetAmount || 0) && updated.status !== 'COMPLETED') {
      await prisma.parcelParticipant.update({ where: { id: participant.id }, data: { status: 'COMPLETED' } });
    }
    const finalParticipant = await prisma.parcelParticipant.findUnique({ where: { id: participant.id }, include: includeData });
    return res.status(201).json({ success: true, contribution, participant: formatParticipant(finalParticipant) });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Setoran gagal dicatat.' }); }
});

router.delete('/:id', optionalAuth, async (req, res) => {
  try { const participant = await prisma.parcelParticipant.findUnique({ where: { id: req.params.id } }); if (req.user?.role === 'PARCEL_MANAGER' && participant?.regionId !== req.user.regionId) return res.status(403).json({ success: false, message: 'Peserta ini bukan bagian dari wilayah Anda.' }); await prisma.parcelParticipant.delete({ where: { id: req.params.id } }); return res.json({ success: true, message: 'Peserta parsel berhasil dihapus.' }); }
  catch (error) { return res.status(error.code === 'P2025' ? 404 : 500).json({ success: false, message: error.message || 'Peserta parsel gagal dihapus.' }); }
});

export default router;