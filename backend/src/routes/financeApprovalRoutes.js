import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { z } from 'zod';

const requestSchema = z.object({ amount: z.coerce.number().positive(), description: z.string().trim().min(1) });
const decisionSchema = z.object({ accountId: z.string().optional().nullable(), reason: z.string().trim().optional() });
const router = express.Router();
router.use(authenticateToken);
router.get('/', requireRole('OWNER'), async (req, res) => {
  const rows = await prisma.financeApproval.findMany({ where: { ...(req.query.status ? { status: String(req.query.status) } : {}) }, include: { requestedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  return res.json({ success: true, data: rows.map((row) => ({ ...row, amount: Number(row.amount) })) });
});
router.post('/', requireRole('OWNER', 'ADMIN', 'CASHIER'), validateBody(requestSchema), async (req, res) => {
  if (Number(req.body.amount) <= Number(process.env.FINANCE_APPROVAL_THRESHOLD || 500000)) return res.status(400).json({ success: false, message: 'Nominal belum melewati batas approval.' });
  const row = await prisma.financeApproval.create({ data: { ...req.body, requestedById: req.user.id } });
  return res.status(201).json({ success: true, data: { ...row, amount: Number(row.amount) } });
});
router.patch('/:id/approve', requireRole('OWNER'), validateBody(decisionSchema), async (req, res) => {
  try {
    const approval = await prisma.financeApproval.findUnique({ where: { id: req.params.id } });
    if (!approval || approval.status !== 'PENDING') return res.status(404).json({ success: false, message: 'Approval tidak ditemukan atau sudah diproses.' });
    const account = req.body.accountId ? await prisma.financeAccount.findFirst({ where: { id: req.body.accountId, isActive: true, deletedAt: null } }) : await prisma.financeAccount.upsert({ where: { id: 'finance-default-cash' }, create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH' }, update: {} });
    if (!account) return res.status(400).json({ success: false, message: 'Akun transaksi tidak valid.' });
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.financeCategory.upsert({ where: { name_type: { name: 'Approval pengeluaran', type: 'EXPENSE' } }, create: { name: 'Approval pengeluaran', type: 'EXPENSE', isDefault: true }, update: {} });
      const transaction = await tx.financeTransaction.create({ data: { type: 'EXPENSE', amount: approval.amount, description: approval.description, accountId: account.id, categoryId: category.id, userId: req.user.id } });
      return tx.financeApproval.update({ where: { id: approval.id }, data: { status: 'APPROVED', approvedById: req.user.id, transactionId: transaction.id, decidedAt: new Date() } });
    });
    return res.json({ success: true, data: { ...result, amount: Number(result.amount) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Approval gagal.' });
  }
});
router.patch('/:id/reject', requireRole('OWNER'), validateBody(decisionSchema), async (req, res) => {
  if (!req.body.reason) return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
  try { const row = await prisma.financeApproval.update({ where: { id: req.params.id }, data: { status: 'REJECTED', reason: req.body.reason, approvedById: req.user.id, decidedAt: new Date() } }); return res.json({ success: true, data: row }); } catch { return res.status(404).json({ success: false, message: 'Approval tidak ditemukan.' }); }
});
export default router;
