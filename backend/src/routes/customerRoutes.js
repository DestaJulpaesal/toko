import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, customerCreateSchema, customerUpdateSchema } from '../middleware/security.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = express.Router();
router.use(authenticateToken);

// Helper to add or deduct points from customer
export async function updateCustomerPoints(customerId, pointsDelta) {
  if (!customerId) return null;

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (customer) {
      const current = Number(customer.points || 0);
      const newPoints = Math.max(current + pointsDelta, 0);
      await prisma.customer.update({
        where: { id: customerId },
        data: { points: newPoints },
      });
      return { previousPoints: current, newPoints };
    }
  } catch (err) {
    console.warn('Prisma customer update failed:', err.message);
  }

  return null;
}

// GET /api/customers - List all customers with points
router.get('/', async (req, res) => {
  const { search } = req.query;

  try {
    const where = search
      ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { phone: { contains: String(search) } },
            { email: { contains: String(search), mode: 'insensitive' } },
          ],
        }
      : undefined;

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    // GET /api/customers/:id/detail - customer purchase profile (without member points)
    router.get('/:id/detail', async (req, res) => {
      try {
        const customer = await prisma.customer.findUnique({
          where: { id: req.params.id },
          include: {
            orders: {
              where: { status: { notIn: ['CANCELLED', 'VOIDED'] } },
              orderBy: { createdAt: 'desc' },
              include: { items: { select: { name: true, quantity: true, unitPrice: true, total: true } } },
            },
            debts: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          },
        });
        if (!customer) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });

        const orders = customer.orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: Number(order.total || 0),
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            name: item.name,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || 0),
          })),
        }));
        const frequentProducts = {};
        orders.forEach((order) => order.items.forEach((item) => {
          const key = item.name;
          if (!frequentProducts[key]) frequentProducts[key] = { name: key, quantity: 0, total: 0 };
          frequentProducts[key].quantity += item.quantity;
          frequentProducts[key].total += item.total;
        }));
        const debts = customer.debts.map((debt) => ({
          id: debt.id, amount: Number(debt.amount || 0), paidAmount: Number(debt.paidAmount || 0),
          remainingAmount: Math.max(Number(debt.amount || 0) - Number(debt.paidAmount || 0), 0),
          status: debt.status, dueDate: debt.dueDate, description: debt.description || '', createdAt: debt.createdAt,
        }));
        return res.json({
          success: true,
          customer: {
            id: customer.id, name: customer.name, phone: customer.phone, email: customer.email,
            address: customer.address, notes: customer.notes || '',
            createdAt: customer.createdAt,
          },
          summary: {
            totalOrders: orders.length,
            totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
            outstandingDebt: debts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
          },
          orders,
          debts,
          frequentProducts: Object.values(frequentProducts).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
        });
      } catch (error) {
        console.error('Customer detail failed:', error.message);
        return res.status(503).json({ success: false, message: 'Detail pelanggan tidak tersedia.' });
      }
    });

    return res.json({
      success: true,
      source: 'database',
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes || '',
        points: Number(c.points || 0),
        createdAt: c.createdAt,
        totalOrders: c._count?.orders || 0,
      })),
    });
  } catch (error) {
    console.error('Customer database unavailable:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database pelanggan tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

// POST /api/customers - Create a new customer
router.post('/', requireRole('OWNER', 'ADMIN'), validateBody(customerCreateSchema), async (req, res) => {
  const { name, phone, email, address, notes, points = 0 } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi' });
  }

  const initialPoints = Math.max(Number(points) || 0, 0);

  const customerData = {
    name: name.trim(),
    phone: phone ? phone.trim() : null,
    email: email ? email.trim() : null,
    address: address ? address.trim() : null,
    notes: notes ? notes.trim() : null,
    points: initialPoints,
  };

  try {
    const created = await prisma.customer.create({
      data: customerData,
    });
    await writeAuditLog({ entityType: 'Customer', entityId: created.id, field: 'record', newValue: customerData, changedById: req.user.id });
    return res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan',
      customer: {
        ...created,
        points: initialPoints,
        notes: created.notes || '',
        totalOrders: 0,
      },
    });
  } catch (error) {
    console.error('Customer create failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database pelanggan tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', requireRole('OWNER', 'ADMIN'), validateBody(customerUpdateSchema), async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, notes, points } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi' });
  }

  try {
    const before = await prisma.customer.findUnique({ where: { id } });
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : undefined,
        ...(points !== undefined ? { points: Math.max(Number(points) || 0, 0) } : {}),
      },
    });
    await writeAuditLog({ entityType: 'Customer', entityId: id, field: 'record', oldValue: before, newValue: updated, changedById: req.user.id });
    return res.json({
      success: true,
      message: 'Data pelanggan berhasil diperbarui',
      customer: {
        ...updated,
        points: Number(updated.points || 0),
        notes: updated.notes || '',
      },
    });
  } catch (error) {
    console.error('Customer update failed:', error.message);
    return res.status(error.code === 'P2025' ? 404 : 503).json({
      success: false,
      message: error.code === 'P2025' ? 'Pelanggan tidak ditemukan' : 'Database pelanggan tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await prisma.customer.delete({ where: { id } });
    await writeAuditLog({ entityType: 'Customer', entityId: id, field: 'record', oldValue: deleted, newValue: null, changedById: req.user.id });
    return res.json({ success: true, message: 'Pelanggan berhasil dihapus' });
  } catch (error) {
    console.error('Customer delete failed:', error.message);
    return res.status(error.code === 'P2025' ? 404 : 503).json({
      success: false,
      message: error.code === 'P2025' ? 'Pelanggan tidak ditemukan' : 'Database pelanggan tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

export default router;
