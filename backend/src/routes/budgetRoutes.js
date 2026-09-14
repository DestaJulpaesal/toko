import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { budgetSchema, validateBody } from '../middleware/security.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));

function period(month, year) {
  const start = new Date(Number(year), Number(month) - 1, 1);
  return { gte: start, lt: new Date(Number(year), Number(month), 1) };
}

async function formatBudget(budget) {
  const spent = await prisma.financeTransaction.aggregate({
    where: { categoryId: budget.categoryId, type: 'EXPENSE', deletedAt: null, createdAt: period(budget.month, budget.year) },
    _sum: { amount: true },
  });
  const limitAmount = Number(budget.limitAmount);
  const spentAmount = Number(spent._sum.amount || 0);
  const percentageUsed = limitAmount ? (spentAmount / limitAmount) * 100 : 0;
  return {
    ...budget,
    limitAmount,
    spentAmount,
    remainingAmount: limitAmount - spentAmount,
    percentageUsed,
    status: spentAmount >= limitAmount ? 'OVER' : spentAmount >= limitAmount * 0.8 ? 'WARNING' : 'OK',
    category: budget.category ? { ...budget.category } : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year = Number(req.query.year || now.getFullYear());
    const budgets = await prisma.budget.findMany({ where: { month, year, deletedAt: null }, include: { category: true }, orderBy: { createdAt: 'asc' } });
    return res.json({ success: true, data: await Promise.all(budgets.map(formatBudget)) });
  } catch {
    return res.status(503).json({ success: false, message: 'Budget tidak dapat diambil.' });
  }
});

router.post('/', validateBody(budgetSchema), async (req, res) => {
  try {
    const budget = await prisma.budget.upsert({
      where: { categoryId_month_year: { categoryId: req.body.categoryId, month: req.body.month, year: req.body.year } },
      create: req.body,
      update: { limitAmount: req.body.limitAmount },
      include: { category: true },
    });
    return res.status(201).json({ success: true, data: await formatBudget(budget) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Budget gagal disimpan.' });
  }
});

router.patch('/:id', validateBody(budgetSchema.partial()), async (req, res) => {
  try {
    const budget = await prisma.budget.update({ where: { id: req.params.id }, data: req.body, include: { category: true } });
    return res.json({ success: true, data: await formatBudget(budget) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Budget gagal diperbarui.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await prisma.budget.updateMany({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) return res.status(404).json({ success: false, message: 'Budget tidak ditemukan.' });
    return res.json({ success: true, message: 'Budget dipindahkan ke arsip.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: 'Budget gagal dihapus.' });
  }
});

export default router;
