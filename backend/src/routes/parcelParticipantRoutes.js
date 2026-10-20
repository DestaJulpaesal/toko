import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, parcelParticipantCreateSchema, parcelParticipantUpdateSchema, parcelContributionSchema } from '../middleware/security.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN', 'PARCEL_MANAGER'));

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
    adminFee: Number(item.adminFee || 0),
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
  parcel: { select: { id: true, name: true, price: true, adminFee: true } },
  program: { select: { id: true, name: true, year: true } },
  region: { select: { id: true, name: true, code: true } },
  contributions: { orderBy: { paidAt: 'desc' } },
};

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = req.query.status ? { status: String(req.query.status).toUpperCase() } : {};
    if (req.query.regionId) where.regionId = String(req.query.regionId);
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { participantPhone: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (req.user?.role === 'PARCEL_MANAGER') where.regionId = req.user.regionId || '__unassigned__';
    const rows = await prisma.parcelParticipant.findMany({ where, include: includeData, orderBy: { createdAt: 'desc' } });
    const participants = rows.map(formatParticipant);
    const collectionStatus = String(req.query.collectionStatus || '').toUpperCase();
    const filtered = ['PAID', 'UNPAID', 'OVERDUE'].includes(collectionStatus)
      ? participants.filter((item) => collectionStatus === 'PAID' ? item.collectionStatus === 'COMPLETED' : collectionStatus === 'OVERDUE' ? item.collectionStatus === 'OVERDUE' : item.collectionStatus === 'DUE')
      : participants;
    return res.json({ success: true, participants: filtered });
  } catch (error) { return res.status(500).json({ success: false, message: error.message || 'Peserta parsel gagal dimuat.' }); }
});

router.post('/', validateBody(parcelParticipantCreateSchema), async (req, res) => {
  try {
    const { customerId, participantPhone, participantName, parcelId, programId, name, contributionAmount, frequency = 'DAILY', startDate, endDate, notes } = req.body || {};
    const participantDisplayName = String(participantName || name || '').trim();
    if (!participantDisplayName || (!parcelId && !programId) || Number(contributionAmount) <= 0) return res.status(400).json({ success: false, message: 'Nama peserta, paket parsel, dan nominal setoran wajib diisi.' });
    const parcel = parcelId
      ? await prisma.parcel.findUnique({ where: { id: String(parcelId) }, select: { id: true, price: true, basePrice: true, adminFee: true } })
      : null;
    if (parcelId && !parcel) return res.status(400).json({ success: false, message: 'Paket parsel tidak ditemukan.' });
    const program = !parcel && programId
      ? await prisma.parcelProgram.findUnique({ where: { id: String(programId) }, select: { name: true, targetAmount: true } })
      : null;
    if (!parcel && !program) return res.status(400).json({ success: false, message: 'Paket parsel tidak ditemukan.' });
    const officialAdminFee = parcel ? Number(parcel.adminFee || 0) : 0;
    const officialSalePrice = parcel ? Number(parcel.price || 0) : 0;
    const officialTargetAmount = parcel
      ? officialSalePrice + officialAdminFee
      : Number(program.targetAmount || 0);
    const officialGrossMargin = parcel
      ? officialSalePrice - Number(parcel.basePrice || 0)
      : 0;
    const normalizedFrequency = String(frequency).toUpperCase();
    const officialContributionAmount = parcel
      ? Math.ceil(officialTargetAmount / (normalizedFrequency === 'WEEKLY' ? 52 : 365))
      : Number(contributionAmount);
    const regionId = req.user?.role === 'PARCEL_MANAGER' ? req.user.regionId || null : (req.body?.regionId || null);
    const created = await prisma.parcelParticipant.create({ data: { customerId: customerId ? String(customerId) : null, participantPhone: participantPhone ? String(participantPhone).trim() : null, parcelId: parcel?.id || null, programId: program ? programId : null, regionId, name: participantDisplayName, targetAmount: officialTargetAmount, salePrice: officialSalePrice, grossMargin: officialGrossMargin, adminFee: officialAdminFee, managerCommission: Number(req.body?.managerCommission || 0), contributionAmount: officialContributionAmount, frequency: normalizedFrequency, startDate: startDate ? new Date(startDate) : new Date(), endDate: endDate ? new Date(endDate) : null, notes: notes ? String(notes).trim() : null }, include: includeData });
    await writeAuditLog({ entityType: 'ParcelParticipant', entityId: created.id, field: 'CREATE', newValue: { name: created.name, programId: created.programId, regionId: created.regionId, targetAmount: created.targetAmount }, changedById: req.user.id });
    return res.status(201).json({ success: true, participant: formatParticipant(created) });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Peserta parsel gagal dibuat.' }); }
});

router.patch('/:id', validateBody(parcelParticipantUpdateSchema), async (req, res) => {
  try {
    const { customerId, participantName, participantPhone, parcelId, programId, name, targetAmount, contributionAmount, frequency, startDate, endDate, status, notes } = req.body || {};
    const existing = await prisma.parcelParticipant.findUnique({ where: { id: req.params.id } });
    if (req.user?.role === 'PARCEL_MANAGER' && existing?.regionId !== req.user.regionId) return res.status(403).json({ success: false, message: 'Peserta ini bukan bagian dari wilayah Anda.' });
    const effectiveParcelId = parcelId !== undefined ? parcelId : existing?.parcelId;
    const parcel = effectiveParcelId
      ? await prisma.parcel.findUnique({ where: { id: String(effectiveParcelId) }, select: { id: true, price: true, basePrice: true, adminFee: true } })
      : null;
    if (effectiveParcelId && !parcel) return res.status(400).json({ success: false, message: 'Paket parsel tidak ditemukan.' });
    const program = programId ? await prisma.parcelProgram.findUnique({ where: { id: String(programId) }, select: { name: true, targetAmount: true } }) : null;
    const normalizedFrequency = String(frequency || existing?.frequency || 'DAILY').toUpperCase();
    const parcelTargetAmount = parcel ? Number(parcel.price) + Number(parcel.adminFee || 0) : null;
    const officialContributionAmount = parcel
      ? Math.ceil(parcelTargetAmount / (normalizedFrequency === 'WEEKLY' ? 52 : 365))
      : contributionAmount !== undefined ? Number(contributionAmount) : undefined;
    const updated = await prisma.parcelParticipant.update({ where: { id: req.params.id }, data: { ...(customerId !== undefined ? { customerId: customerId ? String(customerId) : null } : {}), ...(participantPhone !== undefined ? { participantPhone: participantPhone ? String(participantPhone).trim() : null } : {}), ...(parcelId !== undefined ? { parcelId: parcel?.id || null } : {}), ...(programId !== undefined ? { programId: programId || null } : {}), ...(participantName !== undefined || name !== undefined ? { name: String(participantName || name || '').trim() } : {}), ...(parcel ? { targetAmount: parcelTargetAmount, salePrice: Number(parcel.price), grossMargin: Number(parcel.price) - Number(parcel.basePrice || 0), adminFee: Number(parcel.adminFee || 0) } : program?.targetAmount !== undefined ? { targetAmount: Number(program.targetAmount), adminFee: 0 } : targetAmount !== undefined ? { targetAmount: Number(targetAmount) } : {}), ...(officialContributionAmount !== undefined ? { contributionAmount: officialContributionAmount } : {}), ...(frequency ? { frequency: normalizedFrequency } : {}), ...(startDate ? { startDate: new Date(startDate) } : {}), endDate: endDate ? new Date(endDate) : null, ...(status ? { status: String(status).toUpperCase() } : {}), notes: notes ? String(notes).trim() : null }, include: includeData });
    await writeAuditLog({ entityType: 'ParcelParticipant', entityId: updated.id, field: 'UPDATE', oldValue: { name: existing?.name, status: existing?.status, targetAmount: existing?.targetAmount }, newValue: { name: updated.name, status: updated.status, targetAmount: updated.targetAmount }, changedById: req.user.id });
    return res.json({ success: true, participant: formatParticipant(updated) });
  } catch (error) { return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: error.message || 'Peserta parsel gagal diperbarui.' }); }
});

router.post('/:id/contributions', validateBody(parcelContributionSchema), async (req, res) => {
  try {
    const participant = await prisma.parcelParticipant.findUnique({ where: { id: req.params.id } });
    if (!participant) return res.status(404).json({ success: false, message: 'Peserta parsel tidak ditemukan.' });
    if (req.user?.role === 'PARCEL_MANAGER' && participant.regionId !== req.user.regionId) return res.status(403).json({ success: false, message: 'Peserta ini bukan bagian dari wilayah Anda.' });
    const amount = Number(req.body?.amount || participant.contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Nominal setoran tidak valid.' });
    const paid = await prisma.parcelContribution.aggregate({
      where: { participantId: participant.id },
      _sum: { amount: true },
    });
    const remaining = Math.max(Number(participant.targetAmount || 0) - Number(paid._sum.amount || 0), 0);
    if (amount > remaining) return res.status(400).json({ success: false, message: `Nominal setoran melebihi sisa tabungan ${remaining}.` });
    const contribution = await prisma.parcelContribution.create({ data: { participantId: participant.id, amount, paidAt: req.body?.paidAt ? new Date(req.body.paidAt) : new Date(), note: req.body?.note ? String(req.body.note).trim() : null } });
    await writeAuditLog({ entityType: 'ParcelContribution', entityId: contribution.id, field: 'CREATE', newValue: { participantId: participant.id, amount: contribution.amount }, changedById: req.user.id });
    const updated = await prisma.parcelParticipant.findUnique({ where: { id: participant.id }, include: includeData });
    const paidAfterContribution = (updated.contributions || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (paidAfterContribution >= Number(updated.targetAmount || 0) && updated.status !== 'COMPLETED') {
      await prisma.parcelParticipant.update({ where: { id: participant.id }, data: { status: 'COMPLETED' } });
    }
    const finalParticipant = await prisma.parcelParticipant.findUnique({ where: { id: participant.id }, include: includeData });
    return res.status(201).json({ success: true, contribution, participant: formatParticipant(finalParticipant) });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Setoran gagal dicatat.' }); }
});

router.delete('/:id', async (req, res) => {
  try { const participant = await prisma.parcelParticipant.findUnique({ where: { id: req.params.id } }); if (req.user?.role === 'PARCEL_MANAGER' && participant?.regionId !== req.user.regionId) return res.status(403).json({ success: false, message: 'Peserta ini bukan bagian dari wilayah Anda.' }); await prisma.parcelParticipant.delete({ where: { id: req.params.id } }); await writeAuditLog({ entityType: 'ParcelParticipant', entityId: req.params.id, field: 'DELETE', oldValue: participant, changedById: req.user.id }); return res.json({ success: true, message: 'Peserta parsel berhasil dihapus.' }); }
  catch (error) { return res.status(error.code === 'P2025' ? 404 : 500).json({ success: false, message: error.message || 'Peserta parsel gagal dihapus.' }); }
});

export default router;