import express from 'express';
import prisma from '../config/db.js';
import { updateCustomerPoints } from './customerRoutes.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkoutLimiter, checkoutSchema, validateBody } from '../middleware/security.js';

const router = express.Router();

// Calculate earned loyalty points:
// - Minimal 100rb dapat 10 poin (setiap kelipatan 100rb = 10 poin)
// - Minimal 50rb dapat 2 poin (kelipatan 50rb pada sisa = 2 poin)
export function calculateEarnedPoints(amount) {
  const num = Number(amount) || 0;
  if (num < 50000) return 0;
  const ratusan = Math.floor(num / 100000);
  const sisa = num % 100000;
  const bonusSisa = sisa >= 50000 ? 2 : 0;
  return (ratusan * 10) + bonusSisa;
}


// GET /api/orders - Get all POS orders with filtering
router.get('/', authenticateToken, async (req, res) => {
  const { method, search } = req.query;

  try {
    const where = {
      type: 'STORE',
    };

    if (method && method !== 'ALL') {
      where.financeEntries = {
        some: { paymentMethod: String(method).toUpperCase() },
      };
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: true,
        financeEntries: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = orders.map((o) => {
      const finance = o.financeEntries?.[0];
      const earnedPoints = calculateEarnedPoints(Number(o.total));
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        type: o.type,
        status: o.status,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount || 0),
        total: Number(o.total),
        paidAmount: finance ? Number(finance.amount) : Number(o.total),
        change: 0,
        paymentMethod: finance?.paymentMethod || 'CASH',
        paymentReference: finance?.description?.includes('Ref:') ? finance.description.split('Ref:')[1]?.trim() : null,
        customer: o.customer ? { id: o.customer.id, name: o.customer.name, phone: o.customer.phone } : null,
        cashierName: o.user?.name || 'Kasir Glosir',
        earnedPoints,
        items: o.items.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          total: Number(it.total),
        })),
        createdAt: o.createdAt,
      };
    });

    return res.json({ success: true, source: 'database', orders: formatted });
  } catch (error) {
    console.error('Orders database unavailable:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database transaksi tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

// GET /api/orders/:id - Get order detail by id or orderNumber
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        customer: true,
        items: true,
        financeEntries: true,
        user: { select: { name: true } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    const finance = order.financeEntries?.[0];
    const earnedPoints = calculateEarnedPoints(Number(order.total));

    return res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount || 0),
        total: Number(order.total),
        paidAmount: finance ? Number(finance.amount) : Number(order.total),
        paymentMethod: finance?.paymentMethod || 'CASH',
        customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone } : null,
        cashierName: order.user?.name || 'Kasir Glosir',
        earnedPoints,
        items: order.items.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          total: Number(it.total),
        })),
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error('Order lookup failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database transaksi tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

// POST /api/orders/checkout - Process POS checkout with Points, Cash, QRIS, or Bank Transfer
router.post('/checkout', checkoutLimiter, validateBody(checkoutSchema), async (req, res) => {
  try {
    const {
      items,
      paidAmount,
      paymentMethod = 'CASH',
      paymentReference = null,
      customerId = null,
      customerName = null,
      customerType = 'RETAIL',
      cashierName = 'Kasir Glosir',
      redeemedPoints = 0,
      discount = 0,
    } = req.body || {};

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja masih kosong' });
    }

    const orderNumber = `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const variants = await Promise.all(
          items.map((item) =>
            transaction.productVariant.findUnique({
              where: { id: item.variantId },
              include: { product: { include: { category: true } } },
            })
          )
        );

        const lines = items.map((item, index) => {
          const variant = variants[index];
          const quantity = Number(item.quantity);
          if (!variant || !Number.isInteger(quantity) || quantity < 1) {
            throw new Error('Produk atau jumlah beli tidak valid');
          }
          if (!variant.isActive || variant.stockQty < quantity) {
            throw new Error(`Stok produk ${variant.product.name} tidak mencukupi`);
          }
          const unitPrice = customerType === 'WHOLESALE' && variant.wholesalePrice != null ? Number(variant.wholesalePrice) : Number(variant.sellPrice);
          return { variant, quantity, unitPrice, total: unitPrice * quantity };
        });

        const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
        const discountAmount = Math.min(Number(discount) || 0, subtotal);
        const total = Math.max(subtotal - discountAmount, 0);
        const saleCategories = [...new Set(lines.map(({ variant }) => variant.product.category?.name).filter(Boolean))];

        let paid = Number(paidAmount);
        if (paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') {
          paid = total;
        }

        if (!Number.isFinite(paid) || paid < total) {
          throw new Error('Uang dibayar kurang dari total belanja');
        }

        // Customer linking
        let linkedCustomerId = customerId;
        if (!linkedCustomerId && customerName && customerName !== 'Pelanggan Umum') {
          const existingCust = await transaction.customer.findFirst({
            where: { name: { equals: customerName, mode: 'insensitive' } },
          });
          if (existingCust) linkedCustomerId = existingCust.id;
        }

        // Calculate points
        const earnedPoints = calculateEarnedPoints(total);
        const pointsDelta = earnedPoints - (Number(redeemedPoints) || 0);

        const order = await transaction.order.create({
          data: {
            orderNumber,
            type: 'STORE',
            status: 'COMPLETED',
            customerId: linkedCustomerId || undefined,
            subtotal,
            discount: discountAmount,
            total,
            notes: `Points: +${earnedPoints} / -${redeemedPoints}`,
            items: {
              create: lines.map(({ variant, quantity, unitPrice, total }) => ({
                productId: variant.productId,
                variantId: variant.id,
                name: variant.product.name,
                quantity,
                unitPrice,
                total,
              })),
            },
          },
          include: { customer: true },
        });

        for (const { variant, quantity } of lines) {
          await transaction.productVariant.update({
            where: { id: variant.id },
            data: { stockQty: { decrement: quantity } },
          });
          await transaction.stockMovement.create({
            data: {
              productId: variant.productId,
              variantId: variant.id,
              type: 'OUT',
              quantity,
              note: 'Penjualan kasir POS',
              reference: orderNumber,
            },
          });
        }

        const financeDesc = paymentReference
          ? `Penjualan kasir ${orderNumber} (${paymentMethod}) Ref: ${paymentReference}`
          : `Penjualan kasir ${orderNumber} (${paymentMethod})`;

        await transaction.financeTransaction.create({
          data: {
            orderId: order.id,
            type: 'INCOME',
            amount: total,
            description: financeDesc,
            category: saleCategories.join(', ') || 'Penjualan',
            paymentMethod,
          },
        });

        // Update customer points
        let pointDetails = { previousPoints: 0, currentPoints: earnedPoints };
        if (linkedCustomerId) {
          const pointRes = await updateCustomerPoints(linkedCustomerId, pointsDelta);
          if (pointRes) {
            pointDetails = {
              previousPoints: pointRes.previousPoints,
              currentPoints: pointRes.newPoints,
            };
          }
        }

        const orderDetail = {
          id: order.id,
          orderNumber,
          subtotal,
          discount: discountAmount,
          total,
          paidAmount: paid,
          change: Math.max(paid - total, 0),
          paymentMethod,
          paymentReference,
          customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone } : customerName ? { name: customerName } : null,
          cashierName,
          earnedPoints,
          redeemedPoints: Number(redeemedPoints) || 0,
          previousPoints: pointDetails.previousPoints,
          currentPoints: pointDetails.currentPoints,
          items: lines.map(({ variant, quantity, total }) => ({
            name: variant.product.name,
            quantity,
            unitPrice: Number(variant.sellPrice),
            total,
          })),
          createdAt: order.createdAt,
        };

        return orderDetail;
      });

      return res.status(201).json({ success: true, ...result });
    } catch (dbError) {
      console.error('Database checkout failed:', dbError.message);
      return res.status(503).json({
        success: false,
        message: 'Database transaksi tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Transaksi gagal disimpan' });
  }
});

export default router;
