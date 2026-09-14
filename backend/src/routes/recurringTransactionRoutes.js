import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { recurringTransactionSchema, validateBody } from '../middleware/security.js';

const router = express.Router();
const decimal = (value) => Number(value || 0);
const include = { category: true, account: true };
const format = (item) => ({ ...item, amount: decimal(item.amount) });

function addPeriod(date, frequency) {
  const next = new Date(date);
  if (frequency === 'DAILY') next.setDate(next.getDate() + 1);
  else if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function dueDate(item, now = new Date()) {
  if (new Date(item.startDate) > now) return null;
  if (!item.lastRunAt) {
    const first = new Date(item.startDate);
    if (item.frequency === 'MONTHLY' && item.dayOfMonth) first.setDate(Math.min(item.dayOfMonth, 28));
    return first <= now ? first : null;
  }
  const next = addPeriod(item.lastRunAt, item.frequency);
  if (item.frequency === 'MONTHLY' && item.dayOfMonth) next.setDate(Math.min(item.dayOfMonth, 28));
  return next <= now ? next : null;
}

router.post('/run-due', async (req, res, next) => {
  if (!process.env.INTERNAL_JOB_KEY || req.headers['x-internal-key'] !== process.env.INTERNAL_JOB_KEY) {
    return res.status(403).json({ success: false, message: 'Internal key tidak valid.' });
  }
  try {
    const created = await runDue();
    return res.json({ success: true, data: created.map((item) => ({ ...item, amount: decimal(item.amount) })), count: created.length });
  } catch (error) {
    return next(error);
  }
});
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));
router.get('/', async (req, res) => {
  const items = await prisma.recurringTransaction.findMany({ where: { deletedAt: null }, include, orderBy: { createdAt: 'desc' } });
  return res.json({ success: true, data: items.map(format) });
});
router.post('/', validateBody(recurringTransactionSchema), async (req, res) => {
  try {
    const item = await prisma.recurringTransaction.create({ data: { ...req.body, startDate: new Date(req.body.startDate), endDate: req.body.endDate ? new Date(req.body.endDate) : null }, include });
    return res.status(201).json({ success: true, data: format(item) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Transaksi berulang gagal dibuat.' });
  }
});
router.patch('/:id', validateBody(recurringTransactionSchema.partial()), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const item = await prisma.recurringTransaction.update({ where: { id: req.params.id }, data, include });
    return res.json({ success: true, data: format(item) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Transaksi berulang gagal diperbarui.' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    await prisma.recurringTransaction.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    return res.json({ success: true, message: 'Transaksi berulang dipindahkan ke arsip.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Transaksi berulang tidak ditemukan.' });
  }
});

async function runDue() {
  const now = new Date();
  const items = await prisma.recurringTransaction.findMany({ where: { isActive: true, deletedAt: null, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] } });
  const created = [];
  for (const item of items) {
    const due = dueDate(item, now);
    if (!due) continue;
    const transaction = await prisma.$transaction(async (tx) => {
      const account = item.accountId ? await tx.financeAccount.findFirst({ where: { id: item.accountId, isActive: true, deletedAt: null } }) : await tx.financeAccount.upsert({ where: { id: 'finance-default-cash' }, create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH' }, update: {} });
      if (!account) throw new Error(`Akun recurring ${item.id} tidak valid`);
      const category = item.categoryId ? await tx.financeCategory.findFirst({ where: { id: item.categoryId, deletedAt: null } }) : await tx.financeCategory.upsert({ where: { name_type: { name: item.type === 'INCOME' ? 'Pendapatan berulang' : 'Pengeluaran berulang', type: item.type } }, create: { name: item.type === 'INCOME' ? 'Pendapatan berulang' : 'Pengeluaran berulang', type: item.type }, update: {} });
      if (!category) throw new Error(`Kategori recurring ${item.id} tidak valid`);
      return tx.financeTransaction.create({ data: { type: item.type, amount: item.amount, description: item.description, accountId: account.id, categoryId: category.id, category: null } });
    });
    await prisma.recurringTransaction.update({ where: { id: item.id }, data: { lastRunAt: due } });
    created.push(transaction);
  }
  return created;
}

export default router;
