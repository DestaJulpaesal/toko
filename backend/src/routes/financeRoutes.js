import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  validateBody,
  financeCreateSchema,
  financeUpdateSchema,
  reconciliationSchema,
  financeBulkPastePreviewSchema,
  financeBulkPasteConfirmSchema,
} from '../middleware/security.js';
import { logFinanceAudit } from '../services/financeAuditService.js';
import { updateFinanceLoggingStreak } from '../services/financeStreakService.js';

const router = express.Router();
router.use(authenticateToken, (req, res, next) => {
  const isCashierClosing = req.user.role === 'CASHIER' && ['/reconciliation', '/reconciliation/'].includes(req.path);
  if (isCashierClosing || ['OWNER', 'ADMIN'].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Akses keuangan tidak diizinkan.' });
});
const money = (value) => Number(value || 0);
const defaultNames = { INCOME: 'Pendapatan lain-lain', EXPENSE: 'Pengeluaran lain-lain', TRANSFER: 'Transfer antar akun', DEBT: 'Utang usaha' };

async function references(type, accountId, categoryId, client = prisma) {
  const account = accountId
    ? await client.financeAccount.findFirst({ where: { id: accountId, isActive: true, deletedAt: null } })
    : await client.financeAccount.upsert({ where: { id: 'finance-default-cash' }, create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH' }, update: {} });
  if (!account) return { error: 'Akun transaksi tidak valid.' };
  const category = categoryId
    ? await client.financeCategory.findFirst({ where: { id: categoryId, type, deletedAt: null } })
    : await client.financeCategory.upsert({ where: { name_type: { name: defaultNames[type] || defaultNames.EXPENSE, type } }, create: { name: defaultNames[type] || defaultNames.EXPENSE, type, isDefault: true }, update: {} });
  if (!category) return { error: 'Kategori transaksi tidak valid.' };
  return { accountId: account.id, categoryId: category.id };
}

function transactionInclude() {
  return {
    order: {
      select: {
        orderNumber: true,
        customer: { select: { name: true } },
        items: {
          select: {
            variant: {
              select: {
                product: { select: { category: { select: { name: true } } } },
              },
            },
          },
        },
      },
    },
    user: { select: { id: true, name: true } },
    account: { select: { id: true, name: true, type: true } },
    categoryRef: { select: { id: true, name: true, type: true } },
    splits: { include: { category: true } },
    tags: { include: { tag: true } },
    attachments: true,
  };
}

function formatTransaction(tx) {
  const orderCategories = [...new Set((tx.order?.items || []).map((item) => item.variant?.product?.category?.name).filter(Boolean))];
  return {
    id: tx.id, orderId: tx.orderId || null, userId: tx.userId || null, accountId: tx.accountId || null,
    categoryId: tx.categoryId || null, type: tx.type, amount: money(tx.amount), description: tx.description,
    category: tx.categoryRef?.name || tx.category || (orderCategories.length ? orderCategories.join(', ') : null),
    categoryRef: tx.categoryRef || null, account: tx.account || null, paymentMethod: tx.paymentMethod || null,
    createdAt: tx.createdAt, orderNumber: tx.order?.orderNumber || null, customerName: tx.order?.customer?.name || null,
    userName: tx.user?.name || null, splits: (tx.splits || []).map((split) => ({ ...split, amount: money(split.amount) })),
    tags: (tx.tags || []).map((item) => item.tag), attachments: tx.attachments || [],
  };
}

function parseBulkAmount(value, unit) {
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  if (!Number.isFinite(number)) return 0;
  const suffix = String(unit || '').toLowerCase();
  if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') return number * 1000;
  if (suffix === 'jt' || suffix === 'juta') return number * 1000000;
  return number;
}

async function suggestBulkCategory(description, type) {
  const words = String(description).toLowerCase().split(/\s+/).filter((word) => word.length >= 3);
  if (!words.length) return null;
  const candidates = await prisma.financeTransaction.findMany({
    where: { type, deletedAt: null, categoryId: { not: null } },
    select: { description: true, categoryId: true, accountId: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const match = candidates.find((row) => words.some((word) => String(row.description).toLowerCase().includes(word)));
  return match ? { categoryId: match.categoryId, accountId: match.accountId } : null;
}

async function calculateOrderProfit(start, end) {
  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } } : {}) },
    include: { items: { include: { variant: { select: { basePrice: true } } } } },
  });
  return orders.reduce((sum, order) => sum + order.items.reduce((row, item) => row + (money(item.unitPrice) - money(item.variant?.basePrice)) * item.quantity, 0), 0);
}

router.get('/summary', async (req, res) => {
  try {
    const [income, expense, transfer, debt] = await Promise.all(['INCOME', 'EXPENSE', 'TRANSFER', 'DEBT'].map((type) => prisma.financeTransaction.aggregate({ where: { type, deletedAt: null }, _sum: { amount: true }, _count: { _all: true } })));
    const today = new Date(); const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const sum = async (type, start) => money((await prisma.financeTransaction.aggregate({ where: { type, deletedAt: null, createdAt: { gte: start } }, _sum: { amount: true } }))._sum.amount);
    const [todaysIncome, weekIncome, monthIncome, todaysExpense, weekExpense, monthExpense] = await Promise.all(['INCOME', 'EXPENSE'].flatMap((type) => [todayStart, weekStart, monthStart].map((start) => sum(type, start))));
    const [grossProfit, todaysGrossProfit, weekGrossProfit, monthGrossProfit] = await Promise.all([calculateOrderProfit(), calculateOrderProfit(todayStart), calculateOrderProfit(weekStart), calculateOrderProfit(monthStart)]);
    return res.json({ success: true, summary: {
      totalIncome: money(income._sum.amount), totalExpense: money(expense._sum.amount), totalTransfer: money(transfer._sum.amount), totalDebt: money(debt._sum.amount),
      incomeCount: income._count._all, expenseCount: expense._count._all, transferCount: transfer._count._all, debtCount: debt._count._all,
      net: money(income._sum.amount) - money(expense._sum.amount) - money(debt._sum.amount),
      todaysIncome, todaysExpense, todaysNet: todaysIncome - todaysExpense, weekIncome, weekExpense, monthIncome, monthExpense,
      grossProfit, todaysGrossProfit, weekGrossProfit, monthGrossProfit,
    } });
  } catch (error) { console.error('Finance summary failed:', error.message); return res.status(503).json({ success: false, message: 'Data keuangan tidak dapat diambil dari database.' }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const where = { deletedAt: null };
    if (req.query.type && String(req.query.type).toUpperCase() !== 'ALL') where.type = String(req.query.type).toUpperCase();
    if (req.query.tagId) where.tags = { some: { tagId: String(req.query.tagId) } };
    if (req.query.accountId) where.accountId = String(req.query.accountId);
    if (req.query.from || req.query.to) {
      where.createdAt = {
        ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}),
        ...(req.query.to ? { lt: new Date(String(req.query.to)) } : {}),
      };
    }
    if (req.query.search) {
      const text = String(req.query.search).trim();
      where.OR = [{ description: { contains: text, mode: 'insensitive' } }, { category: { contains: text, mode: 'insensitive' } }, { paymentMethod: { contains: text, mode: 'insensitive' } }];
    }
    const rows = await prisma.financeTransaction.findMany({ where, include: transactionInclude(), orderBy: { createdAt: 'desc' }, take: 500 });
    return res.json({ success: true, data: rows.map(formatTransaction), transactions: rows.map(formatTransaction) });
  } catch (error) { return res.status(503).json({ success: false, message: 'Transaksi tidak dapat diambil dari database.' }); }
});

router.get('/unified-history', async (req, res) => {
  try {
    const [transactions, contributions, deposits, netWorth] = await Promise.all([
      prisma.financeTransaction.findMany({ where: { deletedAt: null }, include: transactionInclude(), orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.parcelContribution.findMany({ include: { participant: { select: { name: true, program: { select: { name: true } } } } }, orderBy: { paidAt: 'desc' }, take: 500 }),
      prisma.savingsDeposit.findMany({ include: { goal: { select: { name: true } } }, orderBy: { depositDate: 'desc' }, take: 500 }),
      prisma.netWorthItemHistory.findMany({ include: { item: { select: { name: true, kind: true } } }, orderBy: { addedAt: 'desc' }, take: 500 }),
    ]);
    const data = [
      ...transactions.map((row) => ({ ...formatTransaction(row), source: row.orderId ? 'KASIR / PENJUALAN' : (row.type === 'EXPENSE' ? 'PENGELUARAN' : 'KEUANGAN LAINNYA'), date: row.createdAt })),
      ...contributions.map((row) => ({ id: `parcel-${row.id}`, type: 'INCOME', amount: money(row.amount), description: `Setoran parcel - ${row.participant.name}`, category: row.participant.program?.name || 'Parcel', source: 'PARCEL', date: row.paidAt, paymentMethod: 'Setoran' })),
      ...deposits.map((row) => ({ id: `saving-${row.id}`, type: 'EXPENSE', amount: money(row.amount), description: `Setoran tabungan - ${row.goal.name}`, category: 'Tabungan', source: 'TABUNGAN', date: row.depositDate, paymentMethod: 'Setoran' })),
      ...netWorth.map((row) => ({ id: `networth-${row.id}`, type: row.item.kind === 'ASSET' ? 'ASSET' : 'LIABILITY', amount: money(row.amount), description: `Penambahan ${row.item.name}`, category: 'Aset & Liabilitas', source: 'NET WORTH', date: row.addedAt, paymentMethod: '-' })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Unified finance history failed:', error.message);
    return res.status(503).json({ success: false, message: 'Riwayat keuangan gabungan tidak dapat diambil.' });
  }
});

router.get('/cashflow', async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'monthly'].includes(String(req.query.period)) ? String(req.query.period) : 'daily';
    const months = Math.min(Math.max(Number(req.query.months || 6), 1), 24); const start = new Date(); start.setMonth(start.getMonth() - months); start.setHours(0, 0, 0, 0);
    const rows = await prisma.financeTransaction.findMany({ where: { deletedAt: null, createdAt: { gte: start }, type: { in: ['INCOME', 'EXPENSE'] } }, select: { type: true, amount: true, createdAt: true } });
    const key = (date) => { const d = new Date(date); if (period === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (period === 'weekly') { const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); } return d.toISOString().slice(0, 10); };
    const buckets = new Map();
    rows.forEach((row) => { const date = key(row.createdAt); const bucket = buckets.get(date) || { date, income: 0, expense: 0, net: 0 }; bucket[row.type === 'INCOME' ? 'income' : 'expense'] += money(row.amount); bucket.net = bucket.income - bucket.expense; buckets.set(date, bucket); });
    return res.json({ success: true, data: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)) });
  } catch { return res.status(503).json({ success: false, message: 'Cashflow tidak dapat dihitung.' }); }
});

router.post('/bulk-paste-preview', validateBody(financeBulkPastePreviewSchema), async (req, res) => {
  try {
    const defaultType = req.body.type;
    const lines = req.body.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const drafts = [];
    for (const [index, line] of lines.entries()) {
      const amountMatch = line.match(/(?:rp\s*)?([0-9][0-9.,]*)\s*(rb|ribu|k|jt|juta)?/i);
      if (!amountMatch) {
        drafts.push({ row: index + 1, amount: null, description: line, type: defaultType, error: 'Nominal tidak ditemukan.' });
        continue;
      }
      const amount = parseBulkAmount(amountMatch[1], amountMatch[2]);
      const description = `${line.slice(0, amountMatch.index)} ${line.slice(amountMatch.index + amountMatch[0].length)}`.trim().replace(/^[-:;,]+|[-:;,]+$/g, '').trim();
      const income = /^\s*(\+|masuk|income|terima|penjualan)\b/i.test(line);
      const type = income ? 'INCOME' : defaultType;
      const suggestion = await suggestBulkCategory(description || line, type);
      drafts.push({ row: index + 1, amount, description: description || line, type, categoryId: suggestion?.categoryId || null, accountId: suggestion?.accountId || null, error: amount > 0 ? null : 'Nominal tidak valid.' });
    }
    const [categories, accounts] = await Promise.all([
      prisma.financeCategory.findMany({ where: { deletedAt: null }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
      prisma.financeAccount.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    return res.json({ success: true, data: drafts, drafts, categories, accounts });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Teks transaksi tidak dapat diproses.' });
  }
});

router.post('/bulk-paste-confirm', validateBody(financeBulkPasteConfirmSchema), async (req, res) => {
  try {
    const threshold = Number(process.env.FINANCE_APPROVAL_THRESHOLD || 500000);
    if (req.user.role !== 'OWNER' && req.body.transactions.some((item) => item.type === 'EXPENSE' && item.amount > threshold)) {
      return res.status(403).json({ success: false, message: `Pengeluaran di atas Rp ${threshold.toLocaleString('id-ID')} butuh approval owner.` });
    }
    const created = await prisma.$transaction(async (client) => {
      const rows = [];
      for (const item of req.body.transactions) {
        const refs = await references(item.type, item.accountId, item.categoryId, client);
        if (refs.error) throw new Error(refs.error);
        rows.push(await client.financeTransaction.create({
          data: {
            userId: req.user.id,
            accountId: refs.accountId,
            categoryId: refs.categoryId,
            type: item.type,
            amount: item.amount,
            description: item.description,
            paymentMethod: item.paymentMethod || null,
          },
        }));
      }
      return rows;
    });
    await Promise.all(created.map((row) => logFinanceAudit('FinanceTransaction', row.id, 'CREATE', null, formatTransaction(row), req.user.id)));
    return res.status(201).json({ success: true, data: created.map((row) => ({ id: row.id, type: row.type, amount: money(row.amount), description: row.description })), count: created.length });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Transaksi bulk gagal disimpan.' });
  }
});

router.get('/breakdown', async (req, res) => {
  try {
    const type = String(req.query.type || 'EXPENSE').toUpperCase(); const now = new Date(); const month = Number(req.query.month || now.getMonth() + 1); const year = Number(req.query.year || now.getFullYear());
    const rows = await prisma.financeTransaction.findMany({ where: { type, deletedAt: null, createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }, include: { categoryRef: { select: { id: true, name: true } } } });
    const grouped = rows.reduce((out, row) => { const id = row.categoryRef?.id || 'uncategorized'; const current = out[id] || { categoryId: row.categoryRef?.id || null, category: row.categoryRef?.name || 'Tanpa kategori', amount: 0 }; current.amount += money(row.amount); out[id] = current; return out; }, {});
    return res.json({ success: true, data: Object.values(grouped) });
  } catch { return res.status(503).json({ success: false, message: 'Breakdown keuangan tidak dapat dihitung.' }); }
});

router.get('/reconciliation', async (req, res) => {
  try {
    const rows = await prisma.cashReconciliation.findMany({ where: req.query.accountId ? { accountId: String(req.query.accountId) } : {}, include: { account: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({ success: true, data: rows.map((row) => ({ ...row, systemBalance: money(row.systemBalance), physicalCount: money(row.physicalCount), difference: money(row.difference) })) });
  } catch { return res.status(503).json({ success: false, message: 'Riwayat rekonsiliasi tidak dapat diambil.' }); }
});

router.post('/reconciliation', validateBody(reconciliationSchema), async (req, res) => {
  try {
    const account = await prisma.financeAccount.findFirst({ where: { id: req.body.accountId, deletedAt: null } }); if (!account) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
    const [income, expense, incoming, outgoing] = await Promise.all([
      prisma.financeTransaction.aggregate({ where: { accountId: account.id, type: 'INCOME', deletedAt: null }, _sum: { amount: true } }),
      prisma.financeTransaction.aggregate({ where: { accountId: account.id, type: 'EXPENSE', deletedAt: null }, _sum: { amount: true } }),
      prisma.accountTransfer.aggregate({ where: { toAccountId: account.id }, _sum: { amount: true } }),
      prisma.accountTransfer.aggregate({ where: { fromAccountId: account.id }, _sum: { amount: true } }),
    ]);
    const systemBalance = money(account.startBalance) + money(income._sum.amount) - money(expense._sum.amount) + money(incoming._sum.amount) - money(outgoing._sum.amount);
    const row = await prisma.cashReconciliation.create({ data: { accountId: account.id, systemBalance, physicalCount: req.body.physicalCount, difference: Number(req.body.physicalCount) - systemBalance, note: req.body.note || null, userId: req.user.id } });
    return res.status(201).json({ success: true, data: { ...row, systemBalance: money(row.systemBalance), physicalCount: money(row.physicalCount), difference: money(row.difference) } });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Rekonsiliasi gagal disimpan.' }); }
});

router.get('/audit-log', requireRole('OWNER'), async (req, res) => {
  try {
    const rows = await prisma.financeAuditLog.findMany({ where: { ...(req.query.entityType ? { entityType: String(req.query.entityType) } : {}), ...(req.query.entityId ? { entityId: String(req.query.entityId) } : {}) }, orderBy: { createdAt: 'desc' }, take: 500 });
    return res.json({ success: true, data: rows });
  } catch { return res.status(503).json({ success: false, message: 'Audit log tidak dapat diambil.' }); }
});

router.get('/reports/profit-loss', async (req, res) => {
  try {
    const now = new Date(); const month = Number(req.query.month || now.getMonth() + 1); const year = Number(req.query.year || now.getFullYear()); const start = new Date(year, month - 1, 1); const end = new Date(year, month, 1);
    const [income, expense, cogs] = await Promise.all([
      prisma.financeTransaction.findMany({ where: { type: 'INCOME', deletedAt: null, createdAt: { gte: start, lt: end } }, include: { categoryRef: true } }),
      prisma.financeTransaction.findMany({ where: { type: 'EXPENSE', deletedAt: null, createdAt: { gte: start, lt: end } }, include: { categoryRef: true } }),
      calculateOrderProfit(start, end),
    ]);
    const group = (rows) => Object.values(rows.reduce((out, row) => { const name = row.categoryRef?.name || 'Tanpa kategori'; out[name] = out[name] || { category: name, amount: 0 }; out[name].amount += money(row.amount); return out; }, {}));
    const totalIncome = income.reduce((sum, row) => sum + money(row.amount), 0); const operatingExpense = expense.reduce((sum, row) => sum + money(row.amount), 0);
    return res.json({ success: true, data: { month, year, income: group(income), expenses: group(expense), totalIncome, cogs, operatingExpense, totalExpense: operatingExpense, netProfit: totalIncome - cogs - operatingExpense } });
  } catch (error) { return res.status(503).json({ success: false, message: error.message || 'Laporan laba rugi gagal dibuat.' }); }
});

router.get('/reports/cashflow-statement', async (req, res) => {
  try {
    const now = new Date(); const month = Number(req.query.month || now.getMonth() + 1); const year = Number(req.query.year || now.getFullYear()); const start = new Date(year, month - 1, 1); const end = new Date(year, month, 1);
    const accounts = await prisma.financeAccount.findMany({ where: { deletedAt: null }, include: { transactions: { where: { deletedAt: null, createdAt: { gte: start, lt: end } } }, transfersIn: true, transfersOut: true } });
    return res.json({ success: true, data: accounts.map((account) => { const income = account.transactions.filter((tx) => tx.type === 'INCOME').reduce((sum, tx) => sum + money(tx.amount), 0); const expense = account.transactions.filter((tx) => tx.type === 'EXPENSE').reduce((sum, tx) => sum + money(tx.amount), 0); const incoming = account.transfersIn.filter((tx) => tx.createdAt >= start && tx.createdAt < end).reduce((sum, tx) => sum + money(tx.amount), 0); const outgoing = account.transfersOut.filter((tx) => tx.createdAt >= start && tx.createdAt < end).reduce((sum, tx) => sum + money(tx.amount), 0); return { accountId: account.id, accountName: account.name, income, expense, transferIn: incoming, transferOut: outgoing, net: income - expense + incoming - outgoing, openingBalance: money(account.startBalance), closingBalance: money(account.startBalance) + income - expense + incoming - outgoing }; }) });
  } catch (error) { return res.status(503).json({ success: false, message: error.message || 'Laporan arus kas gagal dibuat.' }); }
});

router.get('/reports/compare', async (req, res) => {
  try {
    const count = Math.min(Math.max(Number(req.query.count || 6), 1), 24); const rows = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - offset); const start = new Date(date.getFullYear(), date.getMonth(), 1); const end = new Date(date.getFullYear(), date.getMonth() + 1, 1); const [income, expense] = await Promise.all(['INCOME', 'EXPENSE'].map((type) => prisma.financeTransaction.aggregate({ where: { type, deletedAt: null, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }))); const value = money(income._sum.amount) - money(expense._sum.amount); const previous = rows.at(-1); rows.push({ period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, income: money(income._sum.amount), expense: money(expense._sum.amount), net: value, growthPercent: previous && previous.net !== 0 ? ((value - previous.net) / Math.abs(previous.net)) * 100 : null }); }
    return res.json({ success: true, data: rows });
  } catch { return res.status(503).json({ success: false, message: 'Perbandingan periode gagal dibuat.' }); }
});

router.get('/reports/forecast', async (req, res) => {
  try {
    const months = Math.min(Math.max(Number(req.query.months || 3), 1), 12); const history = [];
    for (let offset = 1; offset <= 6; offset += 1) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - offset); const [income, expense] = await Promise.all(['INCOME', 'EXPENSE'].map((type) => prisma.financeTransaction.aggregate({ where: { type, deletedAt: null, createdAt: { gte: new Date(d.getFullYear(), d.getMonth(), 1), lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) } }, _sum: { amount: true } }))); history.push({ income: money(income._sum.amount), expense: money(expense._sum.amount) }); }
    const recurring = await prisma.recurringTransaction.findMany({ where: { isActive: true, deletedAt: null }, select: { type: true, amount: true } }); const average = (field) => history.reduce((sum, row) => sum + row[field], 0) / (history.length || 1); const fixed = recurring.reduce((out, row) => { out[row.type === 'INCOME' ? 'income' : 'expense'] += money(row.amount); return out; }, { income: 0, expense: 0 });
    return res.json({ success: true, disclaimer: 'Estimasi, bukan jaminan.', data: Array.from({ length: months }, (_, index) => { const income = average('income') + fixed.income; const expense = average('expense') + fixed.expense; return { month: index + 1, income, expense, net: income - expense }; }) });
  } catch { return res.status(503).json({ success: false, message: 'Forecast gagal dibuat.' }); }
});

router.get('/calendar', async (req, res) => {
  try {
    const now = new Date(); const month = Number(req.query.month || now.getMonth() + 1); const year = Number(req.query.year || now.getFullYear()); const start = new Date(year, month - 1, 1); const end = new Date(year, month, 1);
    const [transactions, recurring, debts, reminders] = await Promise.all([prisma.financeTransaction.findMany({ where: { deletedAt: null, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } }), prisma.recurringTransaction.findMany({ where: { isActive: true, deletedAt: null, startDate: { lt: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] } }), prisma.debtRecord.findMany({ where: { deletedAt: null, dueDate: { gte: start, lt: end } }, include: { customer: { select: { name: true } } } }), prisma.financeReminder.findMany({ where: { dueDate: { gte: start, lt: end } } })]);
    const data = {}; const add = (date, item) => { if (!date) return; const key = new Date(date).toISOString().slice(0, 10); (data[key] ||= []).push(item); };
    transactions.forEach((tx) => add(tx.createdAt, { kind: 'TRANSACTION', id: tx.id, type: tx.type, amount: money(tx.amount), description: tx.description }));
    debts.forEach((debt) => add(debt.dueDate, { kind: 'DEBT_DUE', id: debt.id, customer: debt.customer?.name, amount: money(debt.amount) - money(debt.paidAmount) }));
    reminders.forEach((item) => add(item.dueDate, { kind: 'REMINDER', id: item.id, title: item.title }));
    recurring.forEach((item) => add(item.startDate, { kind: 'RECURRING', id: item.id, description: item.description, amount: money(item.amount) }));
    return res.json({ success: true, data });
  } catch { return res.status(503).json({ success: false, message: 'Kalender keuangan gagal dimuat.' }); }
});

router.get('/:id', async (req, res) => {
  try { const row = await prisma.financeTransaction.findFirst({ where: { id: req.params.id, deletedAt: null }, include: transactionInclude() }); if (!row) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' }); return res.json({ success: true, data: formatTransaction(row) }); } catch { return res.status(503).json({ success: false, message: 'Detail transaksi tidak dapat diambil.' }); }
});

router.post('/', validateBody(financeCreateSchema), async (req, res) => {
  try {
    const { orderId, userId, type, amount, description, category, categoryId, accountId, paymentMethod, splits, tagIds } = req.body;
    const normalizedType = String(type).toUpperCase(); const threshold = Number(process.env.FINANCE_APPROVAL_THRESHOLD || 500000);
    if (normalizedType === 'EXPENSE' && req.user.role !== 'OWNER' && Number(amount) > threshold) return res.status(403).json({ success: false, message: `Pengeluaran di atas Rp ${threshold.toLocaleString('id-ID')} butuh approval owner, silakan ajukan lewat menu approval` });
    if (splits?.length && Math.abs(splits.reduce((sum, split) => sum + Number(split.amount), 0) - Number(amount)) > 0.01) return res.status(400).json({ success: false, message: 'Total split transaksi harus sama dengan nominal.' });
    const refs = await references(normalizedType, accountId, categoryId); if (refs.error) return res.status(400).json({ success: false, message: refs.error });
    const row = await prisma.financeTransaction.create({ data: { orderId: orderId || null, userId: userId || req.user.id, accountId: refs.accountId, categoryId: splits?.length ? null : refs.categoryId, type: normalizedType, amount: Number(amount), description: String(description).trim(), category: category ? String(category).trim() : null, paymentMethod: paymentMethod ? String(paymentMethod).trim() : null, ...(splits?.length ? { splits: { create: splits } } : {}), ...(tagIds?.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}) }, include: transactionInclude() });
    await updateFinanceLoggingStreak(row.userId);
    await logFinanceAudit('FinanceTransaction', row.id, 'CREATE', null, formatTransaction(row), req.user.id);
    return res.status(201).json({ success: true, data: formatTransaction(row), transaction: formatTransaction(row) });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Transaksi tidak dapat disimpan ke database.' }); }
});

router.patch('/:id', validateBody(financeUpdateSchema), async (req, res) => {
  try {
    const existing = await prisma.financeTransaction.findFirst({ where: { id: req.params.id, deletedAt: null }, include: transactionInclude() }); if (!existing) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    const data = { ...(req.body.type ? { type: String(req.body.type).toUpperCase() } : {}), ...(req.body.amount !== undefined ? { amount: Number(req.body.amount) } : {}), ...(req.body.description !== undefined ? { description: String(req.body.description).trim() } : {}), ...(req.body.category !== undefined ? { category: req.body.category || null } : {}), ...(req.body.categoryId !== undefined ? { categoryId: req.body.categoryId || null } : {}), ...(req.body.accountId !== undefined ? { accountId: req.body.accountId || null } : {}), ...(req.body.paymentMethod !== undefined ? { paymentMethod: req.body.paymentMethod || null } : {}) };
    const row = await prisma.financeTransaction.update({ where: { id: req.params.id }, data, include: transactionInclude() }); await logFinanceAudit('FinanceTransaction', row.id, 'UPDATE', formatTransaction(existing), formatTransaction(row), req.user.id);
    return res.json({ success: true, data: formatTransaction(row), transaction: formatTransaction(row) });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Transaksi gagal diperbarui.' }); }
});

router.delete('/:id', async (req, res) => {
  try { const existing = await prisma.financeTransaction.findFirst({ where: { id: req.params.id, deletedAt: null }, include: transactionInclude() }); if (!existing) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' }); const row = await prisma.financeTransaction.update({ where: { id: req.params.id }, data: { deletedAt: new Date() }, include: transactionInclude() }); await logFinanceAudit('FinanceTransaction', row.id, 'DELETE', formatTransaction(existing), formatTransaction(row), req.user.id); return res.json({ success: true, message: 'Transaksi dipindahkan ke arsip.' }); } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Transaksi gagal dihapus.' }); }
});

export default router;
