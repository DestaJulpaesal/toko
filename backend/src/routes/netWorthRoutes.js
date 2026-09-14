import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/security.js';
import { z } from 'zod';

const itemSchema = z.object({ name: z.string().trim().min(1), kind: z.enum(['ASSET', 'LIABILITY']), value: z.coerce.number().nonnegative(), isAuto: z.coerce.boolean().optional() });
const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));
async function normalizeItems() {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.netWorthItem.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
    const groups = new Map();
    rows.forEach((row) => {
      const key = `${row.kind}:${row.name.trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    for (const group of groups.values()) {
      const [primary, ...duplicates] = group;
      for (const row of group) {
        const historyCount = await tx.netWorthItemHistory.count({ where: { itemId: row.id } });
        if (!historyCount) await tx.netWorthItemHistory.create({ data: { itemId: row.id, amount: row.value, addedAt: row.createdAt } });
      }
      if (duplicates.length) {
        await tx.netWorthItem.update({ where: { id: primary.id }, data: { value: group.reduce((sum, row) => sum + Number(row.value), 0) } });
        await tx.netWorthItemHistory.updateMany({ where: { itemId: { in: duplicates.map((row) => row.id) } }, data: { itemId: primary.id } });
        await tx.netWorthItem.updateMany({ where: { id: { in: duplicates.map((row) => row.id) } }, data: { deletedAt: new Date() } });
      }
    }
  });
}
async function calculate() {
  await normalizeItems();
  const [items, accounts, debts, stock] = await Promise.all([
    prisma.netWorthItem.findMany({ where: { deletedAt: null }, include: { history: { orderBy: { addedAt: 'desc' } } } }),
    prisma.financeAccount.findMany({ where: { deletedAt: null, isActive: true }, select: { startBalance: true, transactions: { where: { deletedAt: null }, select: { type: true, amount: true } }, transfersIn: { select: { amount: true } }, transfersOut: { select: { amount: true } } } }),
    prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null }, select: { amount: true, paidAmount: true } }),
    prisma.productVariant.findMany({ where: { isActive: true }, select: { basePrice: true, stockQty: true } }),
  ]);
  const accountBalance = accounts.reduce((sum, account) => sum + Number(account.startBalance) + account.transactions.reduce((value, tx) => value + (tx.type === 'INCOME' ? Number(tx.amount) : tx.type === 'EXPENSE' ? -Number(tx.amount) : 0), 0) + account.transfersIn.reduce((value, item) => value + Number(item.amount), 0) - account.transfersOut.reduce((value, item) => value + Number(item.amount), 0), 0);
  const autoStock = items.some((item) => item.isAuto) ? stock.reduce((sum, item) => sum + Number(item.basePrice || 0) * item.stockQty, 0) : 0;
  const asset = items.filter((item) => item.kind === 'ASSET').reduce((sum, item) => sum + Number(item.value), accountBalance) + autoStock;
  const liability = items.filter((item) => item.kind === 'LIABILITY').reduce((sum, item) => sum + Number(item.value), 0) + debts.reduce((sum, item) => sum + Math.max(Number(item.amount) - Number(item.paidAmount || 0), 0), 0);
  return { totalAsset: asset, totalLiability: liability, netWorth: asset - liability, items };
}
router.get('/', async (req, res) => {
  try {
    const result = await calculate();
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Net worth load failed:', error.message);
    return res.status(503).json({ success: false, message: 'Data kekayaan tidak dapat diambil dari database.' });
  }
});
router.post('/items', validateBody(itemSchema), async (req, res) => {
  try {
    const normalizedName = req.body.name.trim();
    const item = await prisma.$transaction(async (tx) => {
      const matches = await tx.netWorthItem.findMany({
        where: { kind: req.body.kind, deletedAt: null, name: { equals: normalizedName, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      });
      if (!matches.length) {
        const created = await tx.netWorthItem.create({ data: { ...req.body, name: normalizedName } });
        await tx.netWorthItemHistory.create({ data: { itemId: created.id, amount: req.body.value } });
        return created;
      }
      const [primary, ...duplicates] = matches;
      const totalValue = matches.reduce((sum, row) => sum + Number(row.value), Number(req.body.value));
      const updated = await tx.netWorthItem.update({ where: { id: primary.id }, data: { value: totalValue } });
      await tx.netWorthItemHistory.create({ data: { itemId: primary.id, amount: req.body.value } });
      if (duplicates.length) {
        await tx.netWorthItem.updateMany({ where: { id: { in: duplicates.map((row) => row.id) } }, data: { deletedAt: new Date() } });
      }
      return updated;
    });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Net worth item create failed:', error.message);
    return res.status(400).json({ success: false, message: 'Item kekayaan gagal disimpan ke database.' });
  }
});
router.patch('/items/:id', validateBody(itemSchema.partial()), async (req, res) => {
  try { return res.json({ success: true, data: await prisma.netWorthItem.update({ where: { id: req.params.id }, data: req.body }) }); } catch { return res.status(404).json({ success: false, message: 'Item net worth tidak ditemukan.' }); }
});
router.delete('/items/:id', async (req, res) => {
  const result = await prisma.netWorthItem.updateMany({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (!result.count) return res.status(404).json({ success: false, message: 'Item net worth tidak ditemukan.' });
  return res.json({ success: true, message: 'Item net worth dipindahkan ke arsip.' });
});
router.get('/history', async (req, res) => {
  const rows = await prisma.netWorthSnapshot.findMany({ orderBy: { capturedAt: 'desc' }, take: Math.min(Number(req.query.months || 12), 60) });
  return res.json({ success: true, data: rows.map((row) => ({ ...row, totalAsset: Number(row.totalAsset), totalLiability: Number(row.totalLiability), netWorth: Number(row.netWorth) })) });
});
export default router;
