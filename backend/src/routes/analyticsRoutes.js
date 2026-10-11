import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getActiveLoyaltyRule, getExpiringProducts, getProductPerformance } from '../services/loyaltyService.js';

const router = express.Router();
const ownerOnly = [authenticateToken, requireRole('OWNER', 'ADMIN')];

/**
 * FASE 5: Analytics & Loyalty Routes
 */

// ────────────────────────────────────────────
// GET /api/analytics/product-performance
// Laporan barang paling untung vs paling laku
// ────────────────────────────────────────────
router.get('/product-performance', ...ownerOnly, async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const result = await getProductPerformance(startDate, endDate, Number(limit) || 20);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Product performance error:', error.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat laporan produk.' });
  }
});

// ────────────────────────────────────────────
// GET /api/analytics/expiring-products
// Barang yang mendekati kadaluarsa
// ────────────────────────────────────────────
router.get('/expiring-products', ...ownerOnly, async (req, res) => {
  try {
    const withinDays = Number(req.query.days) || 30;
    const products = await getExpiringProducts(withinDays);
    return res.json({ success: true, products });
  } catch (error) {
    console.error('Expiring products error:', error.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat data kadaluarsa.' });
  }
});

// ────────────────────────────────────────────
// GET /api/analytics/loss-sales
// Laporan barang yang dijual rugi
// ────────────────────────────────────────────
router.get('/loss-sales', ...ownerOnly, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Ambil audit log untuk jual rugi
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Order',
        field: 'SELL_BELOW_COST',
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      include: { changedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Ringkasan penjualan lintas dimensi untuk dashboard laporan owner.
    router.get('/sales-report', ...ownerOnly, async (req, res) => {
      try {
        const start = req.query.startDate ? new Date(`${String(req.query.startDate)}T00:00:00`) : null;
        const end = req.query.endDate ? new Date(`${String(req.query.endDate)}T00:00:00`) : null;
        if (end) end.setDate(end.getDate() + 1);
        const createdAt = (start || end) ? { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } : undefined;
        const orders = await prisma.order.findMany({
          where: { status: 'COMPLETED', ...(createdAt ? { createdAt } : {}) },
          select: {
            user: { select: { id: true, name: true } },
            items: {
              where: { productId: { not: null } },
              select: {
                productId: true, name: true, quantity: true, total: true,
                product: { select: { name: true, sku: true, category: { select: { id: true, name: true } } } },
                variant: { select: { basePrice: true } },
              },
            },
          },
        });
        const productMap = new Map();
        const categoryMap = new Map();
        const cashierMap = new Map();
        let revenue = 0;
        let cogs = 0;
        for (const order of orders) {
          const cashier = order.user || { id: 'unassigned', name: 'Tanpa kasir' };
          const cashierRow = cashierMap.get(cashier.id) || { cashierId: cashier.id, cashierName: cashier.name, totalQty: 0, revenue: 0, cogs: 0 };
          for (const item of order.items) {
            const qty = Number(item.quantity);
            const itemRevenue = Number(item.total);
            const itemCogs = Number(item.variant?.basePrice || 0) * qty;
            revenue += itemRevenue; cogs += itemCogs;
            const product = item.product || { name: item.name, sku: '-' };
            const productRow = productMap.get(item.productId) || { productId: item.productId, productName: product.name, productSku: product.sku, totalQty: 0, revenue: 0, cogs: 0, profit: 0 };
            productRow.totalQty += qty; productRow.revenue += itemRevenue; productRow.cogs += itemCogs; productRow.profit += itemRevenue - itemCogs;
            productMap.set(item.productId, productRow);
            const category = product.category || { id: 'uncategorized', name: 'Tanpa kategori' };
            const categoryRow = categoryMap.get(category.id) || { categoryId: category.id, categoryName: category.name, totalQty: 0, revenue: 0, cogs: 0, profit: 0 };
            categoryRow.totalQty += qty; categoryRow.revenue += itemRevenue; categoryRow.cogs += itemCogs; categoryRow.profit += itemRevenue - itemCogs;
            categoryMap.set(category.id, categoryRow);
            cashierRow.totalQty += qty; cashierRow.revenue += itemRevenue; cashierRow.cogs += itemCogs;
          }
          cashierRow.profit = cashierRow.revenue - cashierRow.cogs;
          cashierMap.set(cashier.id, cashierRow);
        }
        const products = [...productMap.values()].map((row) => ({ ...row, margin: row.revenue ? (row.profit / row.revenue) * 100 : 0 }));
        const catalog = await prisma.product.findMany({ select: { id: true, name: true, sku: true, category: { select: { name: true } } } });
        const soldIds = new Set(products.map((row) => row.productId));
        const unsold = catalog.filter((product) => !soldIds.has(product.id)).map((product) => ({ productId: product.id, productName: product.name, productSku: product.sku, categoryName: product.category.name }));
        const expenses = await prisma.financeTransaction.aggregate({ where: { type: 'EXPENSE', deletedAt: null, ...(createdAt ? { createdAt } : {}) }, _sum: { amount: true } });
        const operatingExpense = Number(expenses._sum.amount || 0);
        return res.json({
          success: true,
          period: { startDate: req.query.startDate || null, endDate: req.query.endDate || null },
          summary: { revenue, cogs, grossProfit: revenue - cogs, operatingExpense, netProfit: revenue - cogs - operatingExpense, orderCount: orders.length },
          products: products.sort((a, b) => b.totalQty - a.totalQty),
          bestSelling: [...products].sort((a, b) => b.totalQty - a.totalQty).slice(0, 20),
          unsold,
          categories: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue),
          cashiers: [...cashierMap.values()].sort((a, b) => b.revenue - a.revenue),
        });
      } catch (error) {
        console.error('Sales report error:', error.message);
        return res.status(500).json({ success: false, message: 'Gagal memuat laporan penjualan.' });
      }
    });

    return res.json({
      success: true,
      lossSales: auditLogs.map((log) => ({
        id: log.id,
        orderId: log.entityId,
        detail: log.newValue,
        cashier: log.changedBy?.name || '-',
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('Loss sales error:', error.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat laporan jual rugi.' });
  }
});

// ────────────────────────────────────────────
// LOYALTY RULES
// ────────────────────────────────────────────

// GET /api/analytics/loyalty-rule
router.get('/loyalty-rule', ...ownerOnly, async (req, res) => {
  try {
    const rule = await getActiveLoyaltyRule();
    return res.json({ success: true, rule });
  } catch (error) {
    console.error('Loyalty rule error:', error.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat aturan poin.' });
  }
});

// PATCH /api/analytics/loyalty-rule
router.patch('/loyalty-rule', ...ownerOnly, async (req, res) => {
  try {
    const { pointsPerRp100k, minTransactionAmount } = req.body;
    const rule = await getActiveLoyaltyRule();

    const updated = await prisma.loyaltyRule.update({
      where: { id: rule.id },
      data: {
        ...(pointsPerRp100k !== undefined ? { pointsPerRp100k: Number(pointsPerRp100k) } : {}),
        ...(minTransactionAmount !== undefined ? { minTransactionAmount: Number(minTransactionAmount) } : {}),
      },
    });

    // Catat di audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LoyaltyRule',
        entityId: updated.id,
        field: 'UPDATE_RULE',
        oldValue: JSON.stringify({ pointsPerRp100k: Number(rule.pointsPerRp100k), minTransactionAmount: Number(rule.minTransactionAmount) }),
        newValue: JSON.stringify({ pointsPerRp100k: updated.pointsPerRp100k, minTransactionAmount: Number(updated.minTransactionAmount) }),
        changedById: req.user.id,
      },
    });

    return res.json({ success: true, rule: updated, message: 'Aturan poin berhasil diperbarui.' });
  } catch (error) {
    console.error('Update loyalty rule error:', error.message);
    return res.status(400).json({ success: false, message: 'Gagal memperbarui aturan poin.' });
  }
});

// ────────────────────────────────────────────
// CUSTOMER POINTS
// ────────────────────────────────────────────

// GET /api/analytics/customer-points/:customerId
router.get('/customer-points/:customerId', authenticateToken, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      select: { id: true, name: true, points: true },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });

    // Ambil riwayat poin dari order
    const pointsHistory = await prisma.order.findMany({
      where: {
        customerId: req.params.customerId,
        OR: [{ pointsAwarded: { gt: 0 } }, { pointsRedeemed: { gt: 0 } }],
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        pointsAwarded: true,
        pointsRedeemed: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ success: true, customer, pointsHistory });
  } catch (error) {
    console.error('Customer points error:', error.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat data poin pelanggan.' });
  }
});

// POST /api/analytics/redeem-points
router.post('/redeem-points', authenticateToken, async (req, res) => {
  try {
    const { customerId, pointsToRedeem } = req.body;
    if (!customerId || !pointsToRedeem || pointsToRedeem <= 0) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    if (customer.points < pointsToRedeem) {
      return res.status(400).json({
        success: false,
        message: `Poin tidak cukup. Saldo: ${customer.points} poin, diminta: ${pointsToRedeem} poin.`,
      });
    }

    // 1 poin = Rp1
    const discountAmount = pointsToRedeem;

    await prisma.customer.update({
      where: { id: customerId },
      data: { points: { decrement: pointsToRedeem } },
    });

    // Catat di audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'Customer',
        entityId: customerId,
        field: 'REDEEM_POINTS',
        oldValue: String(customer.points),
        newValue: String(customer.points - pointsToRedeem),
        changedById: req.user.id,
      },
    });

    return res.json({
      success: true,
      discountAmount,
      pointsUsed: pointsToRedeem,
      remainingPoints: customer.points - pointsToRedeem,
      message: `Berhasil tukar ${pointsToRedeem} poin = diskon Rp${discountAmount.toLocaleString('id-ID')}.`,
    });
  } catch (error) {
    console.error('Redeem points error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Gagal menukar poin.' });
  }
});

export default router;
