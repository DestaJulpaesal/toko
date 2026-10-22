import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, debtCreateSchema, debtUpdateSchema } from '../middleware/security.js';
import { parsePagination } from '../utils/pagination.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN', 'CASHIER'));

function formatDebt(record) {
  const amount = Number(record.amount || 0);
  const paidAmount = Number(record.paidAmount || 0);
  return {
    id: record.id,
    customerId: record.customerId,
    customer: record.customer ? { id: record.customer.id, name: record.customer.name, phone: record.customer.phone } : null,
    customerName: record.customer?.name || null,
    amount,
    paidAmount,
    remainingAmount: Math.max(amount - paidAmount, 0),
    status: record.status,
    dueDate: record.dueDate,
    description: record.description || '',
    financeTransactionId: record.financeTransactionId || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

const include = { customer: { select: { id: true, name: true, phone: true } } };

router.get('/', async (req, res) => {
  try {
    const { customerId, status } = req.query || {};
    const usePagination = req.query.page !== undefined || req.query.pageSize !== undefined;
    const pagination = parsePagination(req.query, { defaultPageSize: 25, maxPageSize: 100 });
    const where = { deletedAt: null, ...(customerId ? { customerId: String(customerId) } : {}) };
    if (status) {
      const normalized = String(status).toUpperCase();
      if (normalized === 'OVERDUE') where.status = 'OPEN', where.dueDate = { lt: new Date() };
      else if (normalized !== 'ALL') where.status = normalized;
    }
    const [records, total] = await Promise.all([
      prisma.debtRecord.findMany({
        where,
        include,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        ...(usePagination ? { skip: pagination.skip, take: pagination.take } : {}),
      }),
      usePagination ? prisma.debtRecord.count({ where }) : Promise.resolve(null),
    ]);
    const debts = records.map(formatDebt);
    return res.json({
      success: true,
      data: debts,
      debts,
      ...(usePagination ? {
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.ceil(total / pagination.pageSize),
        },
      } : {}),
    });
  } catch (error) {
    console.error('Debt list failed:', error.message);
    return res.status(503).json({ success: false, message: 'Data piutang tidak dapat diambil dari database.' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [openRows, paidRows, due] = await Promise.all([
      prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null }, select: { amount: true, paidAmount: true } }),
      prisma.debtRecord.aggregate({ where: { status: 'PAID', deletedAt: null, paidAt: { gte: monthStart } }, _sum: { paidAmount: true } }),
      prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null, dueDate: { lt: now } }, include }),
    ]);
    const openAmount = openRows.reduce((sum, row) => sum + Math.max(Number(row.amount) - Number(row.paidAmount || 0), 0), 0);
    return res.json({
      success: true,
      data: { openAmount, paidThisMonth: Number(paidRows._sum.paidAmount || 0), overdue: due.map(formatDebt) },
      summary: { openAmount, paidAmount: Number(paidRows._sum.paidAmount || 0), totalAmount: openAmount, paidThisMonth: Number(paidRows._sum.paidAmount || 0), overdueCount: due.length },
    });
  } catch (error) {
    return res.status(503).json({ success: false, message: 'Ringkasan piutang tidak dapat diambil.' });
  }
});

router.post('/', requireRole('OWNER', 'ADMIN'), validateBody(debtCreateSchema), async (req, res) => {
  try {
    const { customerId, amount, dueDate, description } = req.body;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(400).json({ success: false, message: 'Customer tidak ditemukan.' });
    const record = await prisma.debtRecord.create({ data: { customerId, amount, paidAmount: 0, status: 'OPEN', dueDate: dueDate ? new Date(dueDate) : null, description: description || null }, include });
    return res.status(201).json({ success: true, data: formatDebt(record), debt: formatDebt(record) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Piutang gagal dibuat.' });
  }
});

router.patch('/:id', requireRole('OWNER', 'ADMIN'), validateBody(debtUpdateSchema), async (req, res) => {
  try {
    const existing = await prisma.debtRecord.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Data piutang tidak ditemukan.' });
    const data = {
      ...(req.body.amount !== undefined ? { amount: Number(req.body.amount) } : {}),
      ...(req.body.dueDate !== undefined ? { dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null } : {}),
      ...(req.body.description !== undefined ? { description: req.body.description || null } : {}),
    };
    if (data.amount !== undefined) {
      const remainingAmount = Math.max(data.amount - Number(existing.paidAmount || 0), 0);
      data.status = remainingAmount > 0 ? 'OPEN' : 'PAID';
      data.paidAt = remainingAmount > 0 ? null : existing.paidAt || new Date();
    }
    const record = await prisma.debtRecord.update({ where: { id: req.params.id }, data, include });
    return res.json({ success: true, data: formatDebt(record), debt: formatDebt(record) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Data piutang gagal diperbarui.' });
  }
});

router.post('/:id/pay', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const accountId = String(req.body?.accountId || '');
    if (!Number.isFinite(amount) || amount <= 0 || !accountId) return res.status(400).json({ success: false, message: 'Nominal pembayaran dan akun wajib diisi.' });
    const record = await prisma.debtRecord.findFirst({ where: { id: req.params.id, deletedAt: null }, include });
    if (!record) return res.status(404).json({ success: false, message: 'Data piutang tidak ditemukan.' });
    const remaining = Math.max(Number(record.amount) - Number(record.paidAmount || 0), 0);
    if (remaining <= 0 || record.status === 'PAID') return res.status(400).json({ success: false, message: 'Piutang sudah lunas.' });
    if (amount > remaining) return res.status(400).json({ success: false, message: `Nominal pembayaran melebihi sisa piutang (${remaining}).` });
    const account = await prisma.financeAccount.findFirst({ where: { id: accountId, deletedAt: null, isActive: true } });
    if (!account) return res.status(400).json({ success: false, message: 'Akun penerimaan tidak valid.' });
    const paidAmount = Number(record.paidAmount || 0) + amount;
    const status = paidAmount >= Number(record.amount) ? 'PAID' : 'OPEN';
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.financeCategory.upsert({
        where: { name_type: { name: 'Pembayaran piutang', type: 'INCOME' } },
        create: { name: 'Pembayaran piutang', type: 'INCOME', isDefault: true },
        update: {},
      });
      const transaction = await tx.financeTransaction.create({ data: { type: 'INCOME', amount, accountId, categoryId: category.id, userId: req.user.id, description: `Pembayaran piutang ${record.customer?.name || record.customerId}` } });
      const updatedDebt = await tx.debtRecord.update({ where: { id: record.id }, data: { paidAmount, status, paidAt: status === 'PAID' ? new Date() : null, financeTransactionId: transaction.id }, include });
      if (record.orderId) {
        await tx.order.update({ where: { id: record.orderId }, data: { paidAmount, paymentStatus: status === 'PAID' ? 'PAID' : 'PARTIAL' } });
      }
      return updatedDebt;
    }, { maxWait: 10000, timeout: 30000 });
    return res.json({ success: true, data: formatDebt(result), debt: formatDebt(result) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Pembayaran piutang gagal.' });
  }
});

router.delete('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const result = await prisma.debtRecord.updateMany({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) return res.status(404).json({ success: false, message: 'Data piutang tidak ditemukan.' });
    return res.json({ success: true, message: 'Data piutang dipindahkan ke arsip.' });
  } catch {
    return res.status(400).json({ success: false, message: 'Data piutang gagal dihapus.' });
  }
});

export default router;
