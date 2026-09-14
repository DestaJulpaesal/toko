import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { accountTransferSchema, financeAccountSchema, validateBody } from '../middleware/security.js';

const router = express.Router();
router.use(authenticateToken);

const decimal = (value) => Number(value || 0);
async function balanceFor(account) {
  const [income, expense, incoming, outgoing] = await Promise.all([
    prisma.financeTransaction.aggregate({ where: { accountId: account.id, type: 'INCOME', deletedAt: null }, _sum: { amount: true } }),
    prisma.financeTransaction.aggregate({ where: { accountId: account.id, type: 'EXPENSE', deletedAt: null }, _sum: { amount: true } }),
    prisma.accountTransfer.aggregate({ where: { toAccountId: account.id }, _sum: { amount: true } }),
    prisma.accountTransfer.aggregate({ where: { fromAccountId: account.id }, _sum: { amount: true } }),
  ]);
  return decimal(account.startBalance) + decimal(income._sum.amount) - decimal(expense._sum.amount)
    + decimal(incoming._sum.amount) - decimal(outgoing._sum.amount);
}

router.get('/', requireRole('OWNER', 'ADMIN', 'CASHIER'), async (req, res) => {
  try {
    const accounts = await prisma.financeAccount.findMany({
      where: { deletedAt: null, ...(req.query.includeInactive === 'true' ? {} : { isActive: true }) },
      orderBy: { createdAt: 'asc' },
    });
    const data = await Promise.all(accounts.map(async (account) => ({ ...account, startBalance: decimal(account.startBalance), balance: await balanceFor(account) })));
    return res.json({ success: true, data, accounts: data });
  } catch {
    return res.status(503).json({ success: false, message: 'Akun keuangan tidak dapat diambil.' });
  }
});

router.post('/', requireRole('OWNER', 'ADMIN'), validateBody(financeAccountSchema), async (req, res) => {
  try {
    const account = await prisma.financeAccount.create({ data: { ...req.body, startBalance: req.body.startBalance } });
    return res.status(201).json({ success: true, data: { ...account, startBalance: decimal(account.startBalance), balance: await balanceFor(account) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Akun gagal dibuat.' });
  }
});

router.patch('/:id', requireRole('OWNER', 'ADMIN'), validateBody(financeAccountSchema.partial()), async (req, res) => {
  try {
    const existing = await prisma.financeAccount.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
    const account = await prisma.financeAccount.update({ where: { id: req.params.id }, data: req.body });
    return res.json({ success: true, data: { ...account, startBalance: decimal(account.startBalance), balance: await balanceFor(account) } });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Akun gagal diperbarui.' });
  }
});

router.delete('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.financeAccount.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
    const account = await prisma.financeAccount.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    return res.json({ success: true, data: account, message: 'Akun dipindahkan ke arsip.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Akun gagal dihapus.' });
  }
});

router.post('/transfer', requireRole('OWNER', 'ADMIN'), validateBody(accountTransferSchema), async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, note } = req.body;
    const [from, to] = await Promise.all([
      prisma.financeAccount.findFirst({ where: { id: fromAccountId, deletedAt: null, isActive: true } }),
      prisma.financeAccount.findFirst({ where: { id: toAccountId, deletedAt: null, isActive: true } }),
    ]);
    if (!from || !to) return res.status(404).json({ success: false, message: 'Akun transfer tidak ditemukan atau tidak aktif.' });
    const transfer = await prisma.accountTransfer.create({ data: { fromAccountId, toAccountId, amount, note } });
    return res.status(201).json({ success: true, data: { ...transfer, amount: decimal(transfer.amount) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Transfer gagal disimpan.' });
  }
});

router.get('/:id/history', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const account = await prisma.financeAccount.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!account) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
    const [transactions, outgoing, incoming] = await Promise.all([
      prisma.financeTransaction.findMany({ where: { accountId: account.id, deletedAt: null }, include: { categoryRef: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.accountTransfer.findMany({ where: { fromAccountId: account.id }, include: { toAccount: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.accountTransfer.findMany({ where: { toAccountId: account.id }, include: { fromAccount: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);
    const history = [
      ...transactions.map((item) => ({ ...item, amount: decimal(item.amount), kind: 'TRANSACTION' })),
      ...outgoing.map((item) => ({ ...item, amount: -decimal(item.amount), kind: 'TRANSFER_OUT' })),
      ...incoming.map((item) => ({ ...item, amount: decimal(item.amount), kind: 'TRANSFER_IN' })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, data: history });
  } catch {
    return res.status(503).json({ success: false, message: 'Riwayat akun tidak dapat diambil.' });
  }
});

export default router;
