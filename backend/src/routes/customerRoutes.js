import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));

// Helper to parse points from customer record
export function parseCustomerPoints(notes, fallbackPoints = 0) {
  if (!notes) return fallbackPoints;
  const match = notes.match(/\[POIN:\s*(\d+)\]/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return fallbackPoints;
}

// Helper to embed points into customer notes string
export function embedCustomerPoints(notes, points) {
  const cleanNotes = (notes || '').replace(/\[POIN:\s*\d+\]\s*/gi, '').trim();
  return `[POIN: ${points}] ${cleanNotes}`.trim();
}


// Helper to add or deduct points from customer
export async function updateCustomerPoints(customerId, pointsDelta) {
  if (!customerId) return null;

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (customer) {
      const current = parseCustomerPoints(customer.notes, 0);
      const newPoints = Math.max(current + pointsDelta, 0);
      const updatedNotes = embedCustomerPoints(customer.notes, newPoints);
      await prisma.customer.update({
        where: { id: customerId },
        data: { notes: updatedNotes },
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

    return res.json({
      success: true,
      source: 'database',
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: (c.notes || '').replace(/\[POIN:\s*\d+\]\s*/gi, '').trim(),
        points: parseCustomerPoints(c.notes, 0),
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
router.post('/', async (req, res) => {
  const { name, phone, email, address, notes, points = 0 } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi' });
  }

  const initialPoints = Number(points) || 0;
  const embeddedNotes = initialPoints > 0 ? embedCustomerPoints(notes, initialPoints) : notes ? notes.trim() : null;

  const customerData = {
    name: name.trim(),
    phone: phone ? phone.trim() : null,
    email: email ? email.trim() : null,
    address: address ? address.trim() : null,
    notes: embeddedNotes,
  };

  try {
    const created = await prisma.customer.create({
      data: customerData,
    });
    return res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan',
      customer: {
        ...created,
        points: initialPoints,
        notes: (created.notes || '').replace(/\[POIN:\s*\d+\]\s*/gi, '').trim(),
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
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, notes, points } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi' });
  }

  try {
    let finalNotes = notes ? notes.trim() : '';
    if (points !== undefined) {
      finalNotes = embedCustomerPoints(finalNotes, Number(points) || 0);
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: finalNotes || null,
      },
    });
    return res.json({
      success: true,
      message: 'Data pelanggan berhasil diperbarui',
      customer: {
        ...updated,
        points: parseCustomerPoints(updated.notes, points || 0),
        notes: (updated.notes || '').replace(/\[POIN:\s*\d+\]\s*/gi, '').trim(),
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
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.customer.delete({ where: { id } });
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
