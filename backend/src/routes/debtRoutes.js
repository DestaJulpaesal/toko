import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, debtCreateSchema, debtUpdateSchema } from '../middleware/security.js';

const router = express.Router();
router.use(authenticateToken);

const demoDebtRecords = [
  {
    id: 'debt-demo-1',
    customerId: 'customer-demo-budi',
    customer: { id: 'customer-demo-budi', name: 'Warung Bu Siti', phone: '085712345678' },
    amount: 420000,
    status: 'OPEN',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Piutang pembelian beras 10 karung',
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'debt-demo-2',
    customerId: 'customer-demo-andi',
    customer: { id: 'customer-demo-andi', name: 'Andi Pratama', phone: '081234567890' },
    amount: 180000,
    status: 'PAID',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Pelunasanparsel dan kebutuhan harian',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function formatDebtRecord(record) {
  return {
    id: record.id,
    customerId: record.customerId,
    customerName: record.customer?.name || null,
    amount: Number(record.amount || 0),
    status: record.status,
    dueDate: record.dueDate,
    description: record.description || '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const { customerId, status } = req.query || {};
    const where = { deletedAt: null };

    if (customerId) where.customerId = String(customerId);
    if (status) where.status = String(status).toUpperCase();

    const records = await prisma.debtRecord.findMany({
      where,
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, debts: records.map(formatDebtRecord) });
  } catch (error) {
    const filtered = demoDebtRecords.filter((record) => {
      const { customerId, status } = req.query || {};
      if (customerId && record.customerId !== String(customerId)) return false;
      if (status && record.status !== String(status).toUpperCase()) return false;
      return true;
    });
    return res.json({ success: true, source: 'demo', debts: filtered.map(formatDebtRecord) });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const [open, paid, total] = await Promise.all([
      prisma.debtRecord.aggregate({
        where: { status: 'OPEN', deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.debtRecord.aggregate({
        where: { status: 'PAID', deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.debtRecord.aggregate({
        where: { deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    return res.json({
      success: true,
      summary: {
        openAmount: Number(open._sum.amount || 0),
        paidAmount: Number(paid._sum.amount || 0),
        totalAmount: Number(total._sum.amount || 0),
      },
    });
  } catch (error) {
    const openAmount = demoDebtRecords.filter((item) => item.status === 'OPEN').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidAmount = demoDebtRecords.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return res.json({
      success: true,
      source: 'demo',
      summary: {
        openAmount,
        paidAmount,
        totalAmount: openAmount + paidAmount,
      },
    });
  }
});

router.post('/', requireRole('OWNER', 'ADMIN'), validateBody(debtCreateSchema), async (req, res) => {
  try {
    const { customerId, amount, status = 'OPEN', dueDate, description } = req.body || {};

    if (!customerId || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Customer dan nominal hutang wajib diisi' });
    }

    const record = await prisma.debtRecord.create({
      data: {
        customerId: String(customerId),
        amount: Number(amount),
        status: String(status).toUpperCase(),
        dueDate: dueDate ? new Date(dueDate) : null,
        description: description ? String(description).trim() : null,
      },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });

    return res.status(201).json({ success: true, debt: formatDebtRecord(record) });
  } catch (error) {
    const newRecord = {
      id: `debt-local-${Date.now()}`,
      customerId: String(req.body?.customerId),
      customer: { id: String(req.body?.customerId), name: req.body?.customerName || 'Pelanggan', phone: req.body?.customerPhone || '' },
      amount: Number(req.body?.amount || 0),
      status: String(req.body?.status || 'OPEN').toUpperCase(),
      dueDate: req.body?.dueDate ? new Date(req.body.dueDate).toISOString() : null,
      description: req.body?.description ? String(req.body.description).trim() : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoDebtRecords.unshift(newRecord);
    return res.status(201).json({ success: true, source: 'demo', debt: formatDebtRecord(newRecord) });
  }
});

router.patch('/:id', requireRole('OWNER', 'ADMIN'), validateBody(debtUpdateSchema), async (req, res) => {
  try {
    const { amount, status, dueDate, description } = req.body || {};
    const updateData = {};

    if (amount !== undefined) updateData.amount = Number(amount);
    if (status !== undefined) updateData.status = String(status).toUpperCase();
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;

    const record = await prisma.debtRecord.update({
      where: { id: req.params.id },
      data: updateData,
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });

    return res.json({ success: true, debt: formatDebtRecord(record) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Data hutang tidak ditemukan' : error.message || 'Data hutang gagal diperbarui',
    });
  }
});

router.delete('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.debtRecord.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return res.json({ success: true, message: 'Data hutang dipindahkan ke arsip' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Data hutang tidak ditemukan' : 'Data hutang gagal dihapus',
    });
  }
});

export default router;
