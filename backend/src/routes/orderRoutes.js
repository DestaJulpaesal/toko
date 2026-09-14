import express from 'express';
import prisma from '../config/db.js';
import { updateCustomerPoints } from './customerRoutes.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { checkoutLimiter, checkoutSchema, onlineOrderSchema, validateBody } from '../middleware/security.js';
import { sendWhatsappMessage } from '../services/whatsappService.js';

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
        debtRecord: true,
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
        paidAmount: Number(o.paidAmount || finance?.amount || 0),
        change: 0,
        paymentMethod: o.paymentMethod || finance?.paymentMethod || 'CASH',
        paymentStatus: o.paymentStatus || (o.debtRecord ? 'UNPAID' : 'PAID'),
        remainingAmount: Math.max(Number(o.total) - Number(o.paidAmount || finance?.amount || 0), 0),
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

router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
    const count = await prisma.order.count({ where: { status: 'PENDING', createdAt: { gt: Number.isNaN(since.getTime()) ? new Date(0) : since } } });
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Unread order count failed:', error.message);
    return res.status(503).json({ success: false, message: 'Jumlah pesanan baru tidak dapat diambil dari database.' });
  }
});

router.get('/average-transaction', authenticateToken, async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.order.aggregate({ where: { type: 'STORE', status: 'COMPLETED', createdAt: { gte: since } }, _avg: { total: true }, _count: { _all: true } });
  return res.json({ success: true, average: Number(result._avg.total || 0), count: result._count._all });
});

router.post('/online', checkoutLimiter, validateBody(onlineOrderSchema), async (req, res) => {
  try {
    const { customerName, customerPhone, address, note, promoCode, shippingCost, items } = req.body;
    const variantIds = items.filter((item) => item.variantId).map((item) => item.variantId);
    const parcelIds = items.filter((item) => item.parcelId).map((item) => item.parcelId);
    const eventPackageIds = items.filter((item) => item.eventPackageId).map((item) => item.eventPackageId);
    const [variants, parcels, eventPackages] = await Promise.all([
      prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true }, include: { product: true } }),
      prisma.parcel.findMany({ where: { id: { in: parcelIds }, isActive: true } }),
      prisma.eventPackage.findMany({ where: { id: { in: eventPackageIds }, isActive: true } }),
    ]);
    const lines = items.map((item) => {
      const quantity = Number(item.quantity);
      if (item.variantId) {
        const variant = variants.find((candidate) => candidate.id === item.variantId);
        if (!variant) throw new Error('Produk pada keranjang sudah tidak tersedia');
        return { variantId: variant.id, productId: variant.productId, name: variant.product.name, quantity, unitPrice: Number(variant.sellPrice), total: Number(variant.sellPrice) * quantity };
      }
      if (item.parcelId) {
        const parcel = parcels.find((candidate) => candidate.id === item.parcelId);
        if (!parcel) throw new Error('Parsel pada keranjang sudah tidak tersedia');
        return { parcelId: parcel.id, name: parcel.name, quantity, unitPrice: Number(parcel.price), total: Number(parcel.price) * quantity };
      }
      const eventPackage = eventPackages.find((candidate) => candidate.id === item.eventPackageId);
      if (!eventPackage) throw new Error('Paket acara pada keranjang sudah tidak tersedia');
      return { eventPackageId: eventPackage.id, name: eventPackage.name, quantity, unitPrice: Number(eventPackage.price), total: Number(eventPackage.price) * quantity };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const promoDiscount = promoCode === 'LEBARAN15' ? Math.round(subtotal * 0.15) : promoCode === 'GLOSIR10' ? Math.round(subtotal * 0.1) : promoCode === 'HEMAT25' ? Math.min(25000, subtotal) : promoCode === 'PARSEL20' ? Math.round(subtotal * 0.2) : 0;
    const total = Math.max(subtotal - promoDiscount + Number(shippingCost || 0), 0);
    const orderNumber = `WEB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const normalizedPhone = customerPhone.replace(/\D/g, '').replace(/^0/, '62');
    const storeNumber = String(process.env.STORE_WHATSAPP_NUMBER || process.env.OWNER_WHATSAPP_NUMBER || '').replace(/\D/g, '');
    if (!storeNumber) return res.status(503).json({ success: false, message: 'Nomor WhatsApp toko belum dikonfigurasi' });
    const whatsappText = `Halo Glosir, saya ingin konfirmasi pesanan ${orderNumber}.\nNama: ${customerName}\nWhatsApp: ${normalizedPhone}\nAlamat: ${address}\n\n${lines.map((line) => `${line.name} x${line.quantity} - Rp ${line.total.toLocaleString('id-ID')}`).join('\n')}\n\nSubtotal: Rp ${subtotal.toLocaleString('id-ID')}\nDiskon: Rp ${promoDiscount.toLocaleString('id-ID')}\nOngkir: Rp ${Number(shippingCost || 0).toLocaleString('id-ID')}\nTotal: Rp ${total.toLocaleString('id-ID')}\nPromo: ${promoCode || '-'}`;
    const whatsappLink = `https://wa.me/${storeNumber}?text=${encodeURIComponent(whatsappText)}`;
    const existingCustomer = await prisma.customer.findFirst({ where: { phone: normalizedPhone } });
    const customer = existingCustomer
      ? await prisma.customer.update({ where: { id: existingCustomer.id }, data: { name: customerName, address } })
      : await prisma.customer.create({ data: { name: customerName, phone: normalizedPhone, address } });
    const order = await prisma.order.create({ data: { orderNumber, type: 'ONLINE', status: 'PENDING', customerId: customer.id, subtotal, discount: promoDiscount, shippingCost: Number(shippingCost || 0), total, notes: note || null, whatsappLink, items: { create: lines.map((line) => ({ productId: line.productId, variantId: line.variantId, parcelId: line.parcelId, eventPackageId: line.eventPackageId, name: line.name, quantity: line.quantity, unitPrice: line.unitPrice, total: line.total })) } } });
    return res.status(201).json({ success: true, order: { id: order.id, orderNumber, whatsappLink } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Pesanan online gagal dibuat' });
  }
});

router.patch('/:id/status', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const nextStatus = String(req.body?.status || '').toUpperCase();
  const allowedStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
  if (!allowedStatuses.includes(nextStatus)) return res.status(400).json({ success: false, message: 'Status pesanan tidak valid' });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({ where: { id: req.params.id }, include: { customer: true, items: true } });
      if (!order) throw Object.assign(new Error('Pesanan tidak ditemukan'), { statusCode: 404 });
      if (order.status === nextStatus) return order;
      if (['CONFIRMED', 'COMPLETED'].includes(nextStatus) && !['CONFIRMED', 'COMPLETED'].includes(order.status)) {
        for (const item of order.items.filter((line) => line.variantId)) {
          const variant = await transaction.productVariant.findUnique({ where: { id: item.variantId } });
          if (!variant || variant.stockQty < item.quantity) throw new Error(`Stok ${item.name} tidak mencukupi`);
          await transaction.productVariant.update({ where: { id: variant.id }, data: { stockQty: { decrement: item.quantity } } });
          await transaction.stockMovement.create({ data: { productId: variant.productId, variantId: variant.id, type: 'OUT', quantity: item.quantity, note: `Pesanan online ${order.orderNumber}`, reference: order.orderNumber } });
        }
      }
      const updated = await transaction.order.update({ where: { id: order.id }, data: { status: nextStatus } });
      if (order.customer?.phone && ['CONFIRMED', 'READY', 'CANCELLED'].includes(nextStatus)) {
        const reason = req.body?.reason ? ` Alasan: ${req.body.reason}` : '';
        const messages = { CONFIRMED: `Pesanan ${order.orderNumber} sudah dikonfirmasi, sedang diproses.`, READY: `Pesanan ${order.orderNumber} siap diambil/dikirim.`, CANCELLED: `Pesanan ${order.orderNumber} dibatalkan.${reason}` };
        await sendWhatsappMessage(order.customer.phone, messages[nextStatus]);
      }
      return updated;
    });
    return res.json({ success: true, order: { id: result.id, orderNumber: result.orderNumber, status: result.status } });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Status pesanan gagal diperbarui' });
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

router.patch('/:id/void', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, message: 'Alasan pembatalan wajib diisi' });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({ where: { id: req.params.id }, include: { financeEntries: true } });
      if (!order) throw Object.assign(new Error('Transaksi tidak ditemukan'), { statusCode: 404 });
      if (order.status === 'VOIDED') throw Object.assign(new Error('Transaksi sudah dibatalkan'), { statusCode: 409 });
      const movements = await transaction.stockMovement.findMany({ where: { reference: order.orderNumber, type: 'OUT', variantId: { not: null } } });
      for (const movement of movements) {
        await transaction.productVariant.update({ where: { id: movement.variantId }, data: { stockQty: { increment: movement.quantity } } });
        await transaction.stockMovement.create({ data: { productId: movement.productId, variantId: movement.variantId, type: 'RETURN', quantity: movement.quantity, note: `Void transaksi: ${reason}`, reference: order.orderNumber } });
      }
      await transaction.financeTransaction.updateMany({ where: { orderId: order.id, deletedAt: null }, data: { deletedAt: new Date() } });
      return transaction.order.update({ where: { id: order.id }, data: { status: 'VOIDED', voidReason: reason, voidedById: req.user.id } });
    });
    return res.json({ success: true, order: { id: result.id, status: result.status, voidReason: result.voidReason } });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Transaksi gagal dibatalkan' });
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
        const packageIds = items.filter((item) => item.eventPackageId).map((item) => item.eventPackageId);
        const parcelIds = items.filter((item) => item.parcelId).map((item) => item.parcelId);
        const eventPackages = await transaction.eventPackage.findMany({
          where: { id: { in: packageIds }, isActive: true },
          include: { items: { include: { variant: { include: { product: { include: { category: true } } } } } } },
        });
        const parcels = await transaction.parcel.findMany({
          where: { id: { in: parcelIds }, isActive: true },
          include: { items: { include: { variant: { include: { product: { include: { category: true } } } } } } },
        });
        const variants = await Promise.all(
          items.map((item) =>
            item.variantId ? transaction.productVariant.findUnique({
              where: { id: item.variantId },
              include: { product: { include: { category: true } } },
            }) : null
          )
        );

        const lines = items.map((item, index) => {
          if (item.eventPackageId) {
            const eventPackage = eventPackages.find((candidate) => candidate.id === item.eventPackageId);
            const quantity = Number(item.quantity);
            if (!eventPackage || !Number.isInteger(quantity) || quantity < 1) throw new Error('Paket acara tidak valid');
            for (const packageItem of eventPackage.items) {
              if (!packageItem.variant.isActive || packageItem.variant.stockQty < packageItem.quantity * quantity) {
                throw new Error(`Stok produk ${packageItem.variant.product.name} tidak mencukupi untuk paket ${eventPackage.name}`);
              }
            }
            return { eventPackage, quantity, unitPrice: Number(eventPackage.price), total: Number(eventPackage.price) * quantity };
          }
          if (item.parcelId) {
            const parcel = parcels.find((candidate) => candidate.id === item.parcelId);
            const quantity = Number(item.quantity);
            if (!parcel || !Number.isInteger(quantity) || quantity < 1) throw new Error('Parsel tidak valid');
            for (const parcelItem of parcel.items) {
              if (!parcelItem.variant.isActive || parcelItem.variant.stockQty < parcelItem.quantity * quantity) {
                throw new Error(`Stok produk ${parcelItem.variant.product.name} tidak mencukupi untuk parsel ${parcel.name}`);
              }
            }
            return { parcel, quantity, unitPrice: Number(parcel.price), total: Number(parcel.price) * quantity };
          }
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
        const saleCategories = [...new Set(lines.flatMap((line) => {
          if (line.variant) return [line.variant.product.category?.name];
          if (line.eventPackage) return line.eventPackage.items.map((item) => item.variant.product.category?.name);
          return line.parcel.items.map((item) => item.variant.product.category?.name);
        }).filter(Boolean))];

        let paid = Number(paidAmount);
        if (paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') {
          paid = total;
        }

        if (paymentMethod === 'DEBT' && !customerId) {
          throw new Error('Pelanggan wajib dipilih untuk transaksi bon/utang');
        }
        if (paymentMethod !== 'DEBT' && (!Number.isFinite(paid) || paid < total)) {
          throw new Error('Uang dibayar kurang dari total belanja');
        }
        if (paymentMethod === 'DEBT') paid = 0;

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
            paymentMethod,
            paymentStatus: paymentMethod === 'DEBT' ? 'UNPAID' : 'PAID',
            paidAmount: paid,
            notes: `Points: +${earnedPoints} / -${redeemedPoints}`,
            items: {
              create: lines.map((line) => ({
                productId: line.variant?.productId,
                variantId: line.variant?.id,
                eventPackageId: line.eventPackage?.id,
                parcelId: line.parcel?.id,
                name: line.variant?.product.name || line.eventPackage?.name || line.parcel.name,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                total: line.total,
              })),
            },
          },
          include: { customer: true },
        });

        const stockDeductions = new Map();
        for (const line of lines) {
          if (line.variant) {
            stockDeductions.set(line.variant.id, (stockDeductions.get(line.variant.id) || 0) + line.quantity);
          } else if (line.eventPackage) {
            for (const packageItem of line.eventPackage.items) {
              stockDeductions.set(packageItem.variant.id, (stockDeductions.get(packageItem.variant.id) || 0) + packageItem.quantity * line.quantity);
            }
          } else {
            for (const parcelItem of line.parcel.items) {
              stockDeductions.set(parcelItem.variant.id, (stockDeductions.get(parcelItem.variant.id) || 0) + parcelItem.quantity * line.quantity);
            }
          }
        }
        for (const [variantId, quantity] of stockDeductions) {
          const variant = await transaction.productVariant.findUnique({ where: { id: variantId } });
          if (!variant || variant.stockQty < quantity) throw new Error('Stok berubah. Silakan ulangi checkout.');
          await transaction.productVariant.update({
            where: { id: variantId },
            data: { stockQty: { decrement: quantity } },
          });
          await transaction.stockMovement.create({
            data: {
              productId: variant.productId,
              variantId,
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
        const defaultAccount = await transaction.financeAccount.upsert({
          where: { id: 'finance-default-cash' },
          create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH', startBalance: 0 },
          update: {},
        });
        const salesCategory = await transaction.financeCategory.upsert({
          where: { name_type: { name: 'Penjualan', type: 'INCOME' } },
          create: { name: 'Penjualan', type: 'INCOME', isDefault: true },
          update: {},
        });

        if (paymentMethod !== 'DEBT') {
          await transaction.financeTransaction.create({
            data: {
              orderId: order.id,
              type: 'INCOME',
              amount: total,
              description: financeDesc,
              category: saleCategories.join(', ') || 'Penjualan',
              accountId: defaultAccount.id,
              categoryId: salesCategory.id,
              paymentMethod,
            },
          });
        }

        if (paymentMethod === 'DEBT') {
          await transaction.debtRecord.create({
            data: {
              orderId: order.id,
              customerId: linkedCustomerId,
              amount: total,
              paidAmount: 0,
              status: 'OPEN',
              description: `Bon kasir ${orderNumber}`,
            },
          });
        }

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
          paymentStatus: order.paymentStatus,
          remainingAmount: Math.max(total - paid, 0),
          paymentReference,
          customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone } : customerName ? { name: customerName } : null,
          cashierName,
          earnedPoints,
          redeemedPoints: Number(redeemedPoints) || 0,
          previousPoints: pointDetails.previousPoints,
          currentPoints: pointDetails.currentPoints,
          items: lines.map((line) => ({
            name: line.variant?.product.name || line.eventPackage?.name || line.parcel.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
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
