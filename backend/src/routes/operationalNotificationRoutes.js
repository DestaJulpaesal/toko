import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const role = req.user.role;
  const canOperate = ['OWNER', 'ADMIN', 'CASHIER'].includes(role);
  try {
    const requests = [
      canOperate
        ? prisma.productVariant.findMany({
          where: { isActive: true, OR: [{ stockQty: { lte: 0 } }, { product: { stockWarning: { gt: 0 } } }] },
          select: { id: true, stockQty: true, product: { select: { name: true, stockWarning: true } } },
        })
        : Promise.resolve([]),
      canOperate
        ? prisma.order.findMany({
          where: { status: 'PENDING' },
          select: { id: true, orderNumber: true, total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
        : Promise.resolve([]),
      ['OWNER', 'ADMIN'].includes(role)
        ? prisma.debtRecord.findMany({
          where: { status: 'OPEN', deletedAt: null, dueDate: { lt: new Date() } },
          select: { id: true, amount: true, paidAmount: true, dueDate: true, customer: { select: { name: true } } },
          orderBy: { dueDate: 'asc' },
          take: 20,
        })
        : Promise.resolve([]),
      role === 'OWNER'
        ? prisma.financeApproval.findMany({
          where: { status: 'PENDING' },
          select: { id: true, amount: true, description: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 20,
        })
        : Promise.resolve([]),
      ['OWNER', 'ADMIN'].includes(role)
        ? prisma.financeReminder.findMany({
          where: { status: 'PENDING' },
          select: { id: true, title: true, dueDate: true, type: true },
          orderBy: { dueDate: 'asc' },
          take: 20,
        })
        : Promise.resolve([]),
    ];
    const [variants, orders, debts, approvals, reminders] = await Promise.all(requests);
    const notifications = [
      ...variants
        .filter((variant) => Number(variant.stockQty) <= Number(variant.product.stockWarning || 0))
        .map((variant) => ({
          id: `stock:${variant.id}`,
          type: Number(variant.stockQty) <= 0 ? 'STOCK_OUT' : 'STOCK_LOW',
          title: Number(variant.stockQty) <= 0 ? `Stok habis: ${variant.product.name}` : `Stok menipis: ${variant.product.name}`,
          detail: `${Number(variant.stockQty)} tersisa (minimum ${Number(variant.product.stockWarning || 0)})`,
          href: '/admin/restock',
          createdAt: new Date().toISOString(),
        })),
      ...orders.map((order) => ({
        id: `order:${order.id}`,
        type: 'NEW_ORDER',
        title: `Pesanan baru #${order.orderNumber}`,
        detail: `Rp${Number(order.total).toLocaleString('id-ID')}`,
        href: '/kasir/riwayat',
        createdAt: order.createdAt,
      })),
      ...debts.map((debt) => ({
        id: `debt:${debt.id}`,
        type: 'OVERDUE_DEBT',
        title: `Penagihan terlambat: ${debt.customer?.name || 'Pelanggan'}`,
        detail: `Sisa Rp${Math.max(Number(debt.amount) - Number(debt.paidAmount || 0), 0).toLocaleString('id-ID')}`,
        href: '/admin/debts',
        dueDate: debt.dueDate,
        createdAt: debt.dueDate,
      })),
      ...approvals.map((approval) => ({
        id: `approval:${approval.id}`,
        type: 'FINANCE_APPROVAL',
        title: 'Approval keuangan belum diproses',
        detail: `${approval.description} · Rp${Number(approval.amount).toLocaleString('id-ID')}`,
        href: '/admin/finance/approvals',
        createdAt: approval.createdAt,
      })),
      ...reminders.map((reminder) => ({
        id: `reminder:${reminder.id}`,
        reminderId: reminder.id,
        type: 'FINANCE_REMINDER',
        title: reminder.title,
        detail: 'Reminder keuangan',
        href: '/admin/finance/calendar',
        dueDate: reminder.dueDate,
        createdAt: reminder.dueDate,
      })),
    ];
    return res.json({ success: true, data: notifications, count: notifications.length });
  } catch (error) {
    console.error('Operational notifications unavailable:', error.message);
    return res.status(503).json({ success: false, message: 'Notifikasi operasional sementara tidak tersedia.' });
  }
});

export default router;
