import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { savingsDepositSchema, savingsGoalSchema, validateBody } from '../middleware/security.js';

const router = express.Router();
router.use(authenticateToken);

const dateOnly = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};
async function formatGoal(goal) {
  const totalSaved = goal.deposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0);
  const targetAmount = Number(goal.targetAmount || 0);
  return {
    ...goal,
    targetAmount,
    dailyAmount: Number(goal.dailyAmount || 0),
    totalSaved,
    progressPercent: targetAmount ? Math.min((totalSaved / targetAmount) * 100, 100) : 0,
    deposits: goal.deposits.map((deposit) => ({ ...deposit, amount: Number(deposit.amount), date: deposit.depositDate.toISOString().slice(0, 10) })),
  };
}
const include = { deposits: { orderBy: { depositDate: 'asc' } } };
const ownedGoal = (userId, id) => ({ id, userId, deletedAt: null });

router.get('/goals', async (req, res) => {
  const goals = await prisma.savingsGoal.findMany({ where: { userId: req.user.id, deletedAt: null }, include, orderBy: { createdAt: 'desc' } });
  return res.json({ success: true, data: await Promise.all(goals.map(formatGoal)), goals: await Promise.all(goals.map(formatGoal)) });
});
router.post('/goals', validateBody(savingsGoalSchema), async (req, res) => {
  try {
    const goal = await prisma.savingsGoal.create({ data: { ...req.body, userId: req.user.id }, include });
    return res.status(201).json({ success: true, data: await formatGoal(goal), goal: await formatGoal(goal) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Target tabungan gagal dibuat.' });
  }
});
router.patch('/goals/:id', validateBody(savingsGoalSchema.partial()), async (req, res) => {
  try {
    const existing = await prisma.savingsGoal.findFirst({ where: ownedGoal(req.user.id, req.params.id) });
    if (!existing) return res.status(404).json({ success: false, message: 'Target tabungan tidak ditemukan.' });
    const goal = await prisma.savingsGoal.update({ where: { id: req.params.id }, data: req.body, include });
    return res.json({ success: true, data: await formatGoal(goal) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Target tabungan gagal diperbarui.' });
  }
});
router.delete('/goals/:id', async (req, res) => {
  const existing = await prisma.savingsGoal.findFirst({ where: ownedGoal(req.user.id, req.params.id) });
  if (!existing) return res.status(404).json({ success: false, message: 'Target tabungan tidak ditemukan.' });
  await prisma.savingsGoal.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  return res.json({ success: true, message: 'Target tabungan dipindahkan ke arsip.' });
});
router.post('/goals/:id/deposit', validateBody(savingsDepositSchema), async (req, res) => {
  try {
    const goal = await prisma.savingsGoal.findFirst({ where: ownedGoal(req.user.id, req.params.id) });
    if (!goal) return res.status(404).json({ success: false, message: 'Target tabungan tidak ditemukan.' });
    const depositDate = dateOnly(req.body.date);
    if (!depositDate) return res.status(400).json({ success: false, message: 'Tanggal setoran tidak valid.' });
    const deposit = await prisma.savingsDeposit.create({ data: { goalId: goal.id, amount: req.body.amount || goal.dailyAmount, depositDate } });
    return res.status(201).json({ success: true, data: { ...deposit, amount: Number(deposit.amount), date: deposit.depositDate.toISOString().slice(0, 10) } });
  } catch (error) {
    return res.status(error.code === 'P2002' ? 409 : 400).json({ success: false, message: error.code === 'P2002' ? 'Setoran untuk tanggal tersebut sudah tercatat.' : error.message });
  }
});
router.delete('/goals/:id/deposit/:depositId', async (req, res) => {
  const deposit = await prisma.savingsDeposit.findFirst({ where: { id: req.params.depositId, goal: ownedGoal(req.user.id, req.params.id) } });
  if (!deposit) return res.status(404).json({ success: false, message: 'Setoran tidak ditemukan.' });
  await prisma.savingsDeposit.delete({ where: { id: deposit.id } });
  return res.json({ success: true, message: 'Setoran dibatalkan.' });
});
router.post('/import-local', async (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.goals) ? req.body.goals : [];
  if (!entries.length) return res.status(400).json({ success: false, message: 'Data tabungan lama kosong.' });
  try {
    const imported = await prisma.$transaction(async (tx) => {
      const result = [];
      for (const item of entries) {
        if (!item?.name || Number(item.target || item.targetAmount) <= 0) continue;
        const goal = await tx.savingsGoal.create({ data: { userId: req.user.id, name: String(item.name).trim(), targetAmount: Number(item.target || item.targetAmount), dailyAmount: Number(item.dailyAmount || 0), deposits: { create: [] } } });
        const dates = Array.isArray(item.deposits) ? item.deposits : [];
        for (const raw of dates) {
          const date = dateOnly(raw?.date || raw);
          if (date) await tx.savingsDeposit.create({ data: { goalId: goal.id, amount: Number(raw?.amount || item.dailyAmount || 0), depositDate: date } }).catch((error) => { if (error.code !== 'P2002') throw error; });
        }
        result.push(goal);
      }
      return result;
    });
    return res.status(201).json({ success: true, data: imported, count: imported.length });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Import tabungan gagal.' });
  }
});

export default router;
