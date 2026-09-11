import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER'));

function formatTransaction(tx) {
  const orderCategories = tx.order?.items
    ? [...new Set(tx.order.items.map((item) => item.variant?.product?.category?.name).filter(Boolean))]
    : [];
  return {
    id: tx.id,
    orderId: tx.orderId || null,
    userId: tx.userId || null,
    type: tx.type,
    amount: Number(tx.amount || 0),
    description: tx.description,
    category: tx.category || (orderCategories.length ? orderCategories.join(', ') : null),
    paymentMethod: tx.paymentMethod || null,
    createdAt: tx.createdAt,
    orderNumber: tx.order?.orderNumber || null,
    customerName: tx.order?.customer?.name || null,
    userName: tx.user?.name || null,
  };
}

async function calculateOrderProfit(startDate = null) {
  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', ...(startDate ? { createdAt: { gte: startDate } } : {}) },
    include: { items: { include: { variant: { select: { basePrice: true } } } } },
  });
  return orders.reduce((sum, order) => sum + order.items.reduce((lineSum, item) => lineSum + (Number(item.unitPrice) - Number(item.variant?.basePrice || 0)) * item.quantity, 0), 0);
}

router.get('/summary', async (req, res) => {
  try {
    const [income, expense, transfer, debt] = await Promise.all([
      prisma.financeTransaction.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { type: 'TRANSFER' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.financeTransaction.aggregate({
        where: { type: 'DEBT' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const summary = {
      totalIncome: Number(income._sum.amount || 0),
      totalExpense: Number(expense._sum.amount || 0),
      totalTransfer: Number(transfer._sum.amount || 0),
      totalDebt: Number(debt._sum.amount || 0),
      incomeCount: Number(income._count._all || 0),
      expenseCount: Number(expense._count._all || 0),
      transferCount: Number(transfer._count._all || 0),
      debtCount: Number(debt._count._all || 0),
      net: Number((income._sum.amount || 0) - (expense._sum.amount || 0) - (debt._sum.amount || 0)),
    };

    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayIncomeRow = await prisma.financeTransaction.aggregate({
        where: { type: 'INCOME', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      });
      const todayExpenseRow = await prisma.financeTransaction.aggregate({
        where: { type: 'EXPENSE', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      });
      summary.todaysIncome = Number(todayIncomeRow._sum.amount || 0);
      summary.todaysExpense = Number(todayExpenseRow._sum.amount || 0);
      summary.todaysNet = summary.todaysIncome - summary.todaysExpense;
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [weekIncome, monthIncome, weekExpense, monthExpense] = await Promise.all([
        prisma.financeTransaction.aggregate({ where: { type: 'INCOME', createdAt: { gte: weekStart } }, _sum: { amount: true } }),
        prisma.financeTransaction.aggregate({ where: { type: 'INCOME', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.financeTransaction.aggregate({ where: { type: 'EXPENSE', createdAt: { gte: weekStart } }, _sum: { amount: true } }),
        prisma.financeTransaction.aggregate({ where: { type: 'EXPENSE', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      ]);
      summary.weekIncome = Number(weekIncome._sum.amount || 0);
      summary.monthIncome = Number(monthIncome._sum.amount || 0);
      summary.weekExpense = Number(weekExpense._sum.amount || 0);
      summary.monthExpense = Number(monthExpense._sum.amount || 0);
      const [todayOrderCount, todayCashIncome, lowStockProducts, parcelOverdueCount] = await Promise.all([
        prisma.order.count({ where: { type: 'STORE', status: 'COMPLETED', createdAt: { gte: todayStart } } }),
        prisma.financeTransaction.aggregate({ where: { type: 'INCOME', paymentMethod: 'CASH', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
        prisma.product.findMany({ where: { status: { not: 'HIDDEN' } }, select: { stockWarning: true, variants: { where: { isDefault: true, isActive: true }, select: { stockQty: true }, take: 1 } } }),
        prisma.parcelParticipant.findMany({ select: { targetAmount: true, contributionAmount: true, startDate: true, frequency: true, status: true, contributions: { select: { amount: true } } } }),
      ]);
      summary.todayOrderCount = todayOrderCount;
      summary.todayCashIncome = Number(todayCashIncome._sum.amount || 0);
      summary.lowStockCount = lowStockProducts.filter((product) => Number(product.variants[0]?.stockQty || 0) <= Number(product.stockWarning || 0)).length;
      summary.parcelOverdueCount = parcelOverdueCount.filter((participant) => {
        if (participant.status === 'COMPLETED') return false;
        const paid = participant.contributions.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        if (paid >= Number(participant.targetAmount || 0)) return false;
        const periods = Number(participant.contributionAmount) > 0 ? Math.floor(paid / Number(participant.contributionAmount)) : 0;
        const due = new Date(participant.startDate); due.setDate(due.getDate() + periods * (participant.frequency === 'WEEKLY' ? 7 : 1));
        return due <= today;
      }).length;
      [summary.grossProfit, summary.todaysGrossProfit, summary.weekGrossProfit, summary.monthGrossProfit] = await Promise.all([
        calculateOrderProfit(), calculateOrderProfit(todayStart), calculateOrderProfit(weekStart), calculateOrderProfit(monthStart),
      ]);
      return res.json({ success: true, summary });
    } catch (dbError) {
      return res.json({ success: true, summary });
    }
  } catch (error) {
    console.error('Finance summary failed:', error.message);
    return res.status(503).json({ success: false, message: 'Data keuangan tidak dapat diambil dari database.' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { type, search } = req.query || {};
    const where = {};

    if (type && String(type).toUpperCase() !== 'ALL') {
      where.type = String(type).toUpperCase();
    }

    if (search) {
      const text = String(search).trim();
      where.OR = [
        { description: { contains: text, mode: 'insensitive' } },
        { category: { contains: text, mode: 'insensitive' } },
        { paymentMethod: { contains: text, mode: 'insensitive' } },
      ];
    }

    const transactions = await prisma.financeTransaction.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            customer: { select: { name: true } },
            items: {
              select: {
                variant: {
                  select: { product: { select: { category: { select: { name: true } } } } },
                },
              },
            },
          },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({
      success: true,
      transactions: transactions.map(formatTransaction),
    });
  } catch (error) {
    console.error('Finance transactions failed:', error.message);
    return res.status(503).json({ success: false, message: 'Transaksi tidak dapat diambil dari database.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { orderId, userId, type, amount, description, category, paymentMethod } = req.body || {};

    if (!type || !description || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Tipe, keterangan, dan nominal wajib diisi' });
    }

    const transaction = await prisma.financeTransaction.create({
      data: {
        orderId: orderId || null,
        userId: userId || null,
        type: String(type).toUpperCase(),
        amount: Number(amount),
        description: String(description).trim(),
        category: category ? String(category).trim() : null,
        paymentMethod: paymentMethod ? String(paymentMethod).trim() : null,
      },
      include: {
        order: { select: { orderNumber: true, customer: { select: { name: true } } } },
        user: { select: { name: true } },
      },
    });

    return res.status(201).json({ success: true, transaction: formatTransaction(transaction) });
  } catch (error) {
    return res.status(503).json({ success: false, message: 'Transaksi tidak dapat disimpan ke database.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { type, amount, description, category, paymentMethod } = req.body || {};

    const transaction = await prisma.financeTransaction.update({
      where: { id: req.params.id },
      data: {
        ...(type ? { type: String(type).toUpperCase() } : {}),
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(category !== undefined ? { category: category ? String(category).trim() : null } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod ? String(paymentMethod).trim() : null } : {}),
      },
      include: {
        order: { select: { orderNumber: true, customer: { select: { name: true } } } },
        user: { select: { name: true } },
      },
    });

    return res.json({ success: true, transaction: formatTransaction(transaction) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Transaksi tidak ditemukan' : error.message || 'Transaksi gagal diperbarui',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.financeTransaction.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Transaksi tidak ditemukan' : 'Transaksi gagal dihapus',
    });
  }
});

export default router;
