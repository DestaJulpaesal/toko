import express from 'express';
import { randomUUID } from 'node:crypto';
import prisma from '../config/db.js';
import { updateCustomerPoints } from './customerRoutes.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { checkoutLimiter, checkoutSchema, holdCartSchema, onlineOrderSchema, publicOrderLookupSchema, validateBody } from '../middleware/security.js';
import { sendWhatsappMessage } from '../services/whatsappService.js';
import { validateStockAvailability } from '../utils/stockCalculation.js';
import { getActiveLoyaltyRule, calculatePoints, checkSellBelowCost } from '../services/loyaltyService.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { reverseCompletedOrder } from '../services/orderReversalService.js';
import { recordPromoUse, validatePromoCode } from '../services/promoService.js';
import { getAppSettings } from '../services/appSettingService.js';
import { parsePagination } from '../utils/pagination.js';
import { isValidIndonesianPhone, normalizeIndonesianPhone } from '../utils/phoneUtils.js';

const router = express.Router();
const staffOnly = requireRole('OWNER', 'ADMIN', 'CASHIER');
const createOrderNumber = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID()}`;

function formatExistingCheckout(order) {
  const finance = order.financeEntries?.[0];
  const paidAmount = Number(order.paidAmount || finance?.amount || 0);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount || 0),
    total: Number(order.total),
    paidAmount,
    change: Math.max(paidAmount - Number(order.total), 0),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    remainingAmount: Math.max(Number(order.total) - paidAmount, 0),
    paymentReference: finance?.description?.includes('Ref:') ? finance.description.split('Ref:')[1]?.trim() : null,
    customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone } : null,
    cashierName: order.user?.name || 'Kasir Glosir',
    earnedPoints: Number(order.pointsAwarded || 0),
    redeemedPoints: Number(order.pointsRedeemed || 0),
    items: order.items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    createdAt: order.createdAt,
  };
}

function readHoldMetadata(notes) {
  if (!String(notes || '').startsWith('HOLD_CART:')) return {};
  try {
    return JSON.parse(String(notes).slice('HOLD_CART:'.length));
  } catch {
    return {};
  }
}

function formatHold(order) {
  const metadata = readHoldMetadata(order.notes);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone } : null,
    customerName: metadata.customerName || null,
    customerType: metadata.customerType || 'RETAIL',
    promoId: metadata.promoId || 'none',
    note: metadata.note || '',
    subtotal: Number(order.subtotal),
    discount: Number(order.discount || 0),
    total: Number(order.total),
    itemCount: order.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productId: item.productId,
      parcelId: item.parcelId,
      eventPackageId: item.eventPackageId,
      unitId: item.productUnitId || null,
      unitName: item.productUnit?.name || null,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    cashierName: order.user?.name || 'Kasir Glosir',
    createdAt: order.createdAt,
  };
}


// GET /api/orders - Get all POS orders with filtering
router.get('/', authenticateToken, staffOnly, async (req, res) => {
  const { method, search } = req.query;
  const pagination = parsePagination(req.query, { defaultPageSize: 25 });

  try {
    const where = {};

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

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, address: true } },
          items: { select: { id: true, name: true, quantity: true, unitPrice: true, total: true } },
          financeEntries: { select: { amount: true, paymentMethod: true, description: true } },
          debtRecord: { select: { status: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.order.count({ where }),
    ]);

    const formatted = orders.map((o) => {
      const finance = o.financeEntries?.[0];
      const earnedPoints = Number(o.pointsAwarded || 0);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        type: o.type,
        status: o.status,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount || 0),
        shippingCost: Number(o.shippingCost || 0),
        fulfillmentMethod: o.fulfillmentMethod || 'PICKUP',
        distanceKm: o.distanceKm === null ? null : Number(o.distanceKm),
        total: Number(o.total),
        paidAmount: Number(o.paidAmount || finance?.amount || 0),
        change: 0,
        paymentMethod: o.paymentMethod || finance?.paymentMethod || 'CASH',
        paymentStatus: o.paymentStatus || (o.debtRecord ? 'UNPAID' : 'PAID'),
        remainingAmount: Math.max(Number(o.total) - Number(o.paidAmount || finance?.amount || 0), 0),
        paymentReference: finance?.description?.includes('Ref:') ? finance.description.split('Ref:')[1]?.trim() : null,
        customer: o.customer ? { id: o.customer.id, name: o.customer.name, phone: o.customer.phone, address: o.customer.address } : null,
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

    return res.json({
      success: true,
      source: 'database',
      orders: formatted,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    });
  } catch (error) {
    console.error('Orders database unavailable:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database transaksi tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
    });
  }
});

router.get('/unread-count', authenticateToken, staffOnly, async (req, res) => {
  try {
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
    const count = await prisma.order.count({ where: { status: 'PENDING', createdAt: { gt: Number.isNaN(since.getTime()) ? new Date(0) : since } } });
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Unread order count failed:', error.message);
    return res.status(503).json({ success: false, message: 'Jumlah pesanan baru tidak dapat diambil dari database.' });
  }
});

router.get('/average-transaction', authenticateToken, staffOnly, async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await prisma.order.aggregate({ where: { type: 'STORE', status: 'COMPLETED', createdAt: { gte: since } }, _avg: { total: true }, _count: { _all: true } });
    return res.json({ success: true, average: Number(result._avg.total || 0), count: result._count._all });
  } catch (error) {
    console.error('Average transaction lookup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Rata-rata transaksi sementara tidak tersedia.' });
  }
});

router.post('/lookup', checkoutLimiter, validateBody(publicOrderLookupSchema), async (req, res) => {
  const orderNumber = String(req.body.orderNumber).trim();
  const phoneLastFour = req.body.phoneLastFour;
  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber, type: 'ONLINE' },
      select: {
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { phone: true } },
        items: { select: { name: true, quantity: true, total: true } },
      },
    });
    const storedPhone = String(order?.customer?.phone || '').replace(/\D/g, '');
    if (!order || storedPhone.slice(-4) !== phoneLastFour) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan. Periksa nomor pesanan dan 4 digit nomor WhatsApp.' });
    }
    return res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          total: Number(item.total),
        })),
      },
    });
  } catch (error) {
    console.error('Public order lookup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Status pesanan belum dapat diperiksa. Coba beberapa saat lagi.' });
  }
});

router.post('/online', checkoutLimiter, validateBody(onlineOrderSchema), async (req, res) => {
  try {
    const { customerName, customerPhone, address = '', note, promoCode, fulfillmentMethod, distanceKm, items } = req.body;
    if (!isValidIndonesianPhone(customerPhone)) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp tidak valid. Periksa kembali nomor yang dimasukkan.' });
    }
    const appSettings = await getAppSettings();
    const deliverySettings = appSettings.delivery;
    if (fulfillmentMethod === 'DELIVERY' && !deliverySettings.enabled) {
      return res.status(400).json({ success: false, message: 'Layanan antar sedang tidak tersedia. Silakan pilih ambil di toko.' });
    }
    if (fulfillmentMethod === 'DELIVERY' && (!address.trim() || !Number.isFinite(Number(distanceKm)) || Number(distanceKm) <= 0)) {
      return res.status(400).json({ success: false, message: 'Alamat dan jarak pengiriman wajib diisi untuk layanan antar.' });
    }
    const variantIds = items.filter((item) => item.variantId).map((item) => item.variantId);
    const parcelIds = items.filter((item) => item.parcelId).map((item) => item.parcelId);
    const eventPackageIds = items.filter((item) => item.eventPackageId).map((item) => item.eventPackageId);
    const [variants, parcels, eventPackages] = await Promise.all([
      prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true }, include: { product: true } }),
      prisma.parcel.findMany({ where: { id: { in: parcelIds }, isActive: true }, include: { items: { include: { variant: true } } } }),
      prisma.eventPackage.findMany({ where: { id: { in: eventPackageIds }, isActive: true }, include: { items: { include: { variant: true } } } }),
    ]);
    const lines = items.map((item) => {
      const quantity = Number(item.quantity);
      if (item.variantId) {
        const variant = variants.find((candidate) => candidate.id === item.variantId);
        if (!variant) throw new Error('Produk pada keranjang sudah tidak tersedia');
        if (variant.stockQty < quantity) throw new Error(`Stok ${variant.product.name} tidak mencukupi.`);
        return { variantId: variant.id, productId: variant.productId, name: variant.product.name, quantity, unitPrice: Number(variant.sellPrice), total: Number(variant.sellPrice) * quantity };
      }
      if (item.parcelId) {
        const parcel = parcels.find((candidate) => candidate.id === item.parcelId);
        if (!parcel) throw new Error('Parsel pada keranjang sudah tidak tersedia');
        for (const part of parcel.items) {
          if (!part.variant.isActive || Number(part.variant.stockQty) < Number(part.quantity) * quantity) {
            throw new Error(`Stok ${part.variant.name} tidak mencukupi untuk parsel ${parcel.name}.`);
          }
        }
        return { parcelId: parcel.id, name: parcel.name, quantity, unitPrice: Number(parcel.price), total: Number(parcel.price) * quantity };
      }
      const eventPackage = eventPackages.find((candidate) => candidate.id === item.eventPackageId);
      if (!eventPackage) throw new Error('Paket acara pada keranjang sudah tidak tersedia');
      for (const part of eventPackage.items) {
        if (!part.variant.isActive || Number(part.variant.stockQty) < Number(part.quantity) * quantity) {
          throw new Error(`Stok ${part.variant.name} tidak mencukupi untuk paket ${eventPackage.name}.`);
        }
      }
      return { eventPackageId: eventPackage.id, name: eventPackage.name, quantity, unitPrice: Number(eventPackage.price), total: Number(eventPackage.price) * quantity };
    });
    const requiredStock = new Map();
    const addRequiredStock = (variant, quantity) => {
      const entry = requiredStock.get(variant.id) || { variant, quantity: 0 };
      entry.quantity += Number(quantity);
      requiredStock.set(variant.id, entry);
    };
    for (const line of lines) {
      if (line.variantId) {
        addRequiredStock(variants.find((variant) => variant.id === line.variantId), line.quantity);
      } else if (line.parcelId) {
        const parcel = parcels.find((candidate) => candidate.id === line.parcelId);
        for (const item of parcel.items) addRequiredStock(item.variant, Number(item.quantity) * line.quantity);
      } else {
        const eventPackage = eventPackages.find((candidate) => candidate.id === line.eventPackageId);
        for (const item of eventPackage.items) addRequiredStock(item.variant, Number(item.quantity) * line.quantity);
      }
    }
    for (const { variant, quantity } of requiredStock.values()) {
      if (Number(variant.stockQty) < quantity) {
        throw new Error(`Stok ${variant.name} tidak mencukupi untuk pesanan ini.`);
      }
    }
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    if (fulfillmentMethod === 'DELIVERY' && subtotal < Number(deliverySettings.minimumSubtotal || 0)) {
      return res.status(400).json({ success: false, message: `Minimal belanja Rp${Number(deliverySettings.minimumSubtotal).toLocaleString('id-ID')} untuk membuat pesanan.` });
    }
    const shippingCost = fulfillmentMethod === 'DELIVERY'
      ? Math.max(0, Math.ceil(Number(distanceKm) - Number(deliverySettings.freeDistanceKm || 0))) * Number(deliverySettings.ratePerKm || 0)
      : 0;
    const promoResult = promoCode ? await validatePromoCode(prisma, promoCode, subtotal) : null;
    const promoDiscount = promoResult?.discountAmount || 0;
    const total = Math.max(subtotal - promoDiscount + Number(shippingCost || 0), 0);
    const orderNumber = createOrderNumber('WEB');
    const normalizedPhone = normalizeIndonesianPhone(customerPhone);
    const storeNumber = String(process.env.STORE_WHATSAPP_NUMBER || process.env.OWNER_WHATSAPP_NUMBER || '').replace(/\D/g, '');
    if (!storeNumber) return res.status(503).json({ success: false, message: 'Nomor WhatsApp toko belum dikonfigurasi' });
    const fulfillmentLabel = fulfillmentMethod === 'DELIVERY' ? 'Antar ke alamat' : 'Ambil langsung di toko';
    const distanceLabel = fulfillmentMethod === 'DELIVERY' ? `\nJarak perkiraan : ${Number(distanceKm).toLocaleString('id-ID')} km` : '';
    const itemLines = lines
      .map((line, index) => `${index + 1}. ${line.name}\n   ${line.quantity} x Rp ${line.unitPrice.toLocaleString('id-ID')} = Rp ${line.total.toLocaleString('id-ID')}`)
      .join('\n');
    const noteLine = note?.trim() ? `\nCatatan          : ${note.trim()}` : '';
    const whatsappText = [
      '*KONFIRMASI PESANAN GLOSIR*',
      '━━━━━━━━━━━━━━━━━━━━',
      `No. Pesanan      : ${orderNumber}`,
      `Nama             : ${customerName}`,
      `WhatsApp         : ${normalizedPhone}`,
      `Pengambilan      : ${fulfillmentLabel}${distanceLabel}`,
      noteLine,
      '',
      '*DAFTAR BELANJA*',
      itemLines,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      `Subtotal         : Rp ${subtotal.toLocaleString('id-ID')}`,
      `Diskon           : Rp ${promoDiscount.toLocaleString('id-ID')}`,
      `Ongkir           : Rp ${shippingCost.toLocaleString('id-ID')}`,
      `*TOTAL           : Rp ${total.toLocaleString('id-ID')}*`,
      `Promo            : ${promoCode || '-'}`,
      '',
      'Mohon konfirmasi pesanan saya. Terima kasih.',
    ].join('\n').replace(/\n\n\n+/g, '\n\n');
    const whatsappLink = `https://wa.me/${storeNumber}?text=${encodeURIComponent(whatsappText)}`;
    const { order } = await prisma.$transaction(async (transaction) => {
      let linkedCustomer = await transaction.customer.findFirst({ where: { phone: normalizedPhone } });
      if (linkedCustomer) {
        const missingFields = {};
        if (!linkedCustomer.name?.trim()) missingFields.name = customerName;
        if (!linkedCustomer.address?.trim() && address.trim()) missingFields.address = address.trim();
        if (Object.keys(missingFields).length) {
          linkedCustomer = await transaction.customer.update({ where: { id: linkedCustomer.id }, data: missingFields });
        }
      } else {
        linkedCustomer = await transaction.customer.create({
          data: { name: customerName, phone: normalizedPhone, address: address.trim() || null },
        });
      }

      if (promoResult) {
        const currentPromo = await validatePromoCode(transaction, promoCode, subtotal);
        if (currentPromo.discountAmount !== promoDiscount) throw new Error('Nilai promo berubah. Silakan kirim ulang pesanan.');
        await recordPromoUse(transaction, currentPromo.promo);
      }
      const createdOrder = await transaction.order.create({
        data: {
          orderNumber,
          type: 'ONLINE',
          status: 'PENDING',
          customer: { connect: { id: linkedCustomer.id } },
          subtotal,
          discount: promoDiscount,
          shippingCost,
          fulfillmentMethod,
          distanceKm: fulfillmentMethod === 'DELIVERY' ? Number(distanceKm) : null,
          total,
          notes: note || null,
          whatsappLink,
          items: {
            create: lines.map((line) => ({
              product: line.productId ? { connect: { id: line.productId } } : undefined,
              variant: line.variantId ? { connect: { id: line.variantId } } : undefined,
              parcel: line.parcelId ? { connect: { id: line.parcelId } } : undefined,
              eventPackage: line.eventPackageId ? { connect: { id: line.eventPackageId } } : undefined,
              name: line.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              total: line.total,
            })),
          },
        },
      });
      return { order: createdOrder };
    });
    return res.status(201).json({ success: true, order: { id: order.id, orderNumber, whatsappLink } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Pesanan online gagal dibuat' });
  }
});

// POST /api/orders/hold - Save the current POS cart without reserving stock.
router.post('/hold', checkoutLimiter, authenticateToken, staffOnly, validateBody(holdCartSchema), async (req, res) => {
  const {
    items,
    customerId = null,
    customerName = null,
    customerType = 'RETAIL',
    discount = 0,
    promoId = 'none',
    promoCode = '',
    note = '',
  } = req.body || {};

  try {
    const orderNumber = createOrderNumber('HOLD');
    const hold = await prisma.$transaction(async (transaction) => {
      if (customerId) {
        const customer = await transaction.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw Object.assign(new Error('Pelanggan tidak ditemukan'), { statusCode: 400 });
      }

      const packageIds = items.filter((item) => item.eventPackageId).map((item) => item.eventPackageId);
      const parcelIds = items.filter((item) => item.parcelId).map((item) => item.parcelId);
      const variants = await Promise.all(items.map((item) => (
        item.variantId
          ? transaction.productVariant.findUnique({ where: { id: item.variantId }, include: { product: true } })
          : null
      )));
      const unitIds = [...new Set(items.filter((item) => item.unitId).map((item) => item.unitId))];
      const productUnits = unitIds.length
        ? await transaction.productUnit.findMany({ where: { id: { in: unitIds }, isActive: true } })
        : [];
      const unitById = new Map(productUnits.map((unit) => [unit.id, unit]));
      const [eventPackages, parcels] = await Promise.all([
        transaction.eventPackage.findMany({
          where: { id: { in: packageIds }, isActive: true },
          include: { items: { include: { variant: { include: { product: true } } } } },
        }),
        transaction.parcel.findMany({
          where: { id: { in: parcelIds }, isActive: true },
          include: { items: { include: { variant: { include: { product: true } } } } },
        }),
      ]);

      const lines = items.map((item, index) => {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Jumlah barang tidak valid');
        if (item.eventPackageId) {
          const eventPackage = eventPackages.find((candidate) => candidate.id === item.eventPackageId);
          if (!eventPackage) throw new Error('Paket acara pada keranjang sudah tidak tersedia');
          return { eventPackage, quantity, unitPrice: Number(eventPackage.price), total: Number(eventPackage.price) * quantity };
        }
        if (item.parcelId) {
          const parcel = parcels.find((candidate) => candidate.id === item.parcelId);
          if (!parcel) throw new Error('Parsel pada keranjang sudah tidak tersedia');
          return { parcel, quantity, unitPrice: Number(parcel.price), total: Number(parcel.price) * quantity };
        }
        const variant = variants[index];
        if (!variant || !variant.isActive) throw new Error('Produk pada keranjang sudah tidak tersedia');
        const unit = item.unitId ? unitById.get(item.unitId) : null;
        if (item.unitId && (!unit || unit.productId !== variant.productId)) throw new Error('Unit produk pada keranjang sudah tidak tersedia');
        const unitPrice = unit
          ? Number(customerType === 'WHOLESALE' && unit.wholesalePrice != null ? unit.wholesalePrice : unit.sellPrice)
          : Number(customerType === 'WHOLESALE' && variant.wholesalePrice != null ? variant.wholesalePrice : variant.sellPrice);
        return { variant, productUnit: unit, quantity, unitPrice, total: unitPrice * quantity };
      });

      const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
      const promoResult = promoCode ? await validatePromoCode(transaction, promoCode, subtotal) : null;
      const discountAmount = Math.min(
        (Number(discount) || 0) + (promoResult?.discountAmount || 0),
        subtotal,
      );
      const total = Math.max(subtotal - discountAmount, 0);
      const metadata = JSON.stringify({
        customerName: customerName || null,
        customerType,
        promoId,
        promoCode: String(promoCode || '').trim().toUpperCase(),
        note: String(note || '').trim(),
      });

      return transaction.order.create({
        data: {
          orderNumber,
          type: 'STORE',
          status: 'HOLD',
          user: { connect: { id: req.user.id } },
          customer: customerId ? { connect: { id: customerId } } : undefined,
          subtotal,
          discount: discountAmount,
          total,
          paymentMethod: 'CASH',
          paymentStatus: 'HOLD',
          paidAmount: 0,
          notes: `HOLD_CART:${metadata}`,
          items: {
            create: lines.map((line) => ({
              product: line.variant ? { connect: { id: line.variant.productId } } : undefined,
              variant: line.variant ? { connect: { id: line.variant.id } } : undefined,
              productUnit: line.productUnit ? { connect: { id: line.productUnit.id } } : undefined,
              eventPackage: line.eventPackage ? { connect: { id: line.eventPackage.id } } : undefined,
              parcel: line.parcel ? { connect: { id: line.parcel.id } } : undefined,
              name: line.productUnit ? `${line.variant.product.name} (${line.productUnit.name})` : line.variant?.product.name || line.eventPackage?.name || line.parcel.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              total: line.total,
            })),
          },
        },
        include: {
          customer: true,
          items: { include: { productUnit: true } },
          user: { select: { name: true } },
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Belanjaan berhasil ditahan.',
      hold: formatHold(hold),
    });
  } catch (error) {
    console.error('Hold cart failed:', error.message);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Belanjaan gagal ditahan.',
    });
  }
});

// GET /api/orders/holds - List active carts waiting to be resumed.
router.get('/holds', authenticateToken, staffOnly, async (req, res) => {
  try {
    const holds = await prisma.order.findMany({
      where: { type: 'STORE', status: 'HOLD' },
      include: {
        customer: true,
        items: { include: { productUnit: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return res.json({ success: true, holds: holds.map(formatHold) });
  } catch (error) {
    console.error('Hold cart list failed:', error.message);
    return res.status(503).json({ success: false, message: 'Daftar belanja tertahan tidak dapat diambil.' });
  }
});

router.get('/holds/:id', authenticateToken, staffOnly, async (req, res) => {
  try {
    const hold = await prisma.order.findFirst({
      where: { id: req.params.id, type: 'STORE', status: 'HOLD' },
      include: {
        customer: true,
        items: { include: { productUnit: true } },
        user: { select: { name: true } },
      },
    });
    if (!hold) return res.status(404).json({ success: false, message: 'Belanjaan tertahan tidak ditemukan.' });
    return res.json({ success: true, hold: formatHold(hold) });
  } catch (error) {
    console.error('Hold cart lookup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Belanjaan tertahan tidak dapat diambil.' });
  }
});

router.delete('/holds/:id', authenticateToken, staffOnly, async (req, res) => {
  try {
    const result = await prisma.order.updateMany({
      where: {
        id: req.params.id,
        type: 'STORE',
        status: 'HOLD',
        ...(req.user.role === 'CASHIER' ? { userId: req.user.id } : {}),
      },
      data: { status: 'CANCELLED', notes: 'HOLD_CART:CANCELLED' },
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Belanjaan tertahan tidak ditemukan.' });
    return res.json({ success: true, message: 'Belanjaan tertahan dibatalkan.' });
  } catch (error) {
    console.error('Hold cart cancellation failed:', error.message);
    return res.status(503).json({ success: false, message: 'Belanjaan tertahan gagal dibatalkan.' });
  }
});

const allowedStatusTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'],
  PROCESSING: ['READY', 'COMPLETED', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['CANCELLED'],
  CANCELLED: [],
};

function addOrderStock(deductions, variant, quantity) {
  if (!variant) return;
  const current = deductions.get(variant.id) || { productId: variant.productId, quantity: 0 };
  current.quantity += Number(quantity);
  deductions.set(variant.id, current);
}

router.patch('/:id/status', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const nextStatus = String(req.body?.status || '').toUpperCase();
  if (!Object.hasOwn(allowedStatusTransitions, nextStatus)) return res.status(400).json({ success: false, message: 'Status pesanan tidak valid' });
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          items: {
            include: {
              variant: true,
              parcel: { include: { items: { include: { variant: true } } } },
              eventPackage: { include: { items: { include: { variant: true } } } },
            },
          },
        },
      });
      if (!order) throw Object.assign(new Error('Pesanan tidak ditemukan'), { statusCode: 404 });
      if (order.status === nextStatus) return { order, changed: false };
      if (!allowedStatusTransitions[order.status]?.includes(nextStatus)) {
        throw Object.assign(new Error(`Status ${order.status} tidak dapat diubah menjadi ${nextStatus}`), { statusCode: 409 });
      }
      const claimed = await transaction.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: nextStatus },
      });
      if (claimed.count !== 1) {
        throw Object.assign(new Error('Status pesanan baru saja berubah. Muat ulang lalu coba lagi.'), { statusCode: 409 });
      }

      const hasOutgoingMovement = await transaction.stockMovement.findFirst({
        where: { reference: order.orderNumber, type: 'OUT' },
        select: { id: true },
      });
      if (nextStatus !== 'CANCELLED' && !hasOutgoingMovement) {
        const deductions = new Map();
        for (const item of order.items) {
          if (item.variant) addOrderStock(deductions, item.variant, item.quantity);
          for (const part of item.parcel?.items || []) addOrderStock(deductions, part.variant, Number(part.quantity) * Number(item.quantity));
          for (const part of item.eventPackage?.items || []) addOrderStock(deductions, part.variant, Number(part.quantity) * Number(item.quantity));
        }
        const movements = [];
        for (const [variantId, deduction] of deductions) {
          const changed = await transaction.productVariant.updateMany({
            where: { id: variantId, isActive: true, stockQty: { gte: deduction.quantity } },
            data: { stockQty: { decrement: deduction.quantity } },
          });
          if (!changed.count) {
            const itemName = order.items.find((item) => item.variantId === variantId)?.name || 'produk pesanan';
            throw Object.assign(new Error(`Stok ${itemName} tidak mencukupi`), { statusCode: 409 });
          }
          movements.push({
            productId: deduction.productId,
            variantId,
            type: 'OUT',
            quantity: deduction.quantity,
            note: `Pesanan online ${order.orderNumber}`,
            reference: order.orderNumber,
            changedById: req.user.id,
          });
        }
        if (movements.length) await transaction.stockMovement.createMany({ data: movements });
      }

      if (nextStatus === 'CANCELLED' && hasOutgoingMovement) {
        const movements = await transaction.stockMovement.findMany({ where: { reference: order.orderNumber, type: 'OUT' } });
        for (const movement of movements) {
          if (movement.variantId) {
            await transaction.productVariant.update({ where: { id: movement.variantId }, data: { stockQty: { increment: movement.quantity } } });
          } else {
            await transaction.product.update({ where: { id: movement.productId }, data: { baseStockQty: { increment: movement.quantity } } });
          }
          await transaction.stockMovement.create({
            data: {
              productId: movement.productId,
              variantId: movement.variantId,
              type: 'RETURN',
              quantity: movement.quantity,
              note: `Pembatalan pesanan online ${order.orderNumber}`,
              reference: order.orderNumber,
              changedById: req.user.id,
            },
          });
        }
        await transaction.financeTransaction.updateMany({
          where: { orderId: order.id, type: 'INCOME', deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }

      if (nextStatus === 'COMPLETED') {
        const existingIncome = await transaction.financeTransaction.findFirst({
          where: { orderId: order.id, type: 'INCOME', deletedAt: null },
          select: { id: true },
        });
        if (!existingIncome) {
          const [account, category] = await Promise.all([
            transaction.financeAccount.upsert({
              where: { id: 'finance-default-cash' },
              create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH', startBalance: 0 },
              update: {},
            }),
            transaction.financeCategory.upsert({
              where: { name_type: { name: 'Penjualan', type: 'INCOME' } },
              create: { name: 'Penjualan', type: 'INCOME', isDefault: true },
              update: {},
            }),
          ]);
          await transaction.financeTransaction.create({
            data: {
              orderId: order.id,
              type: 'INCOME',
              amount: order.total,
              description: `Pesanan online ${order.orderNumber}`,
              category: 'Penjualan',
              accountId: account.id,
              categoryId: category.id,
              paymentMethod: order.paymentMethod,
            },
          });
        }
      }

      await writeAuditLog({
        client: transaction,
        entityType: 'Order',
        entityId: order.id,
        field: 'STATUS',
        oldValue: { status: order.status },
        newValue: { status: nextStatus, reason: req.body?.reason || null },
        changedById: req.user.id,
      });
      return { order: { ...order, status: nextStatus, customer: order.customer }, changed: true };
    });

    if (result.changed && result.order.customer?.phone && ['CONFIRMED', 'READY', 'CANCELLED'].includes(nextStatus)) {
      const reason = req.body?.reason ? ` Alasan: ${req.body.reason}` : '';
      const messages = {
        CONFIRMED: `Pesanan ${result.order.orderNumber} sudah dikonfirmasi, sedang diproses.`,
        READY: `Pesanan ${result.order.orderNumber} siap diambil/dikirim.`,
        CANCELLED: `Pesanan ${result.order.orderNumber} dibatalkan.${reason}`,
      };
      try {
        await sendWhatsappMessage(result.order.customer.phone, messages[nextStatus]);
      } catch (error) {
        console.warn(`Order status WhatsApp notification failed for ${result.order.orderNumber}:`, error.message);
      }
    }
    return res.json({ success: true, order: { id: result.order.id, orderNumber: result.order.orderNumber, status: result.order.status } });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Status pesanan gagal diperbarui' });
  }
});

// GET /api/orders/:id - Get order detail by id or orderNumber
router.get('/:id', authenticateToken, staffOnly, async (req, res) => {
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
    const earnedPoints = Number(order.pointsAwarded || 0);

    return res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount || 0),
        shippingCost: Number(order.shippingCost || 0),
        fulfillmentMethod: order.fulfillmentMethod || 'PICKUP',
        distanceKm: order.distanceKm === null ? null : Number(order.distanceKm),
        total: Number(order.total),
        paidAmount: finance ? Number(finance.amount) : Number(order.total),
        paymentMethod: finance?.paymentMethod || 'CASH',
        customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone, address: order.customer.address } : null,
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

async function handleOrderReversal(req, res, action) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, message: 'Alasan pembatalan wajib diisi' });
  try {
    const result = await prisma.$transaction((transaction) => reverseCompletedOrder(transaction, {
      orderId: req.params.id,
      actor: req.user,
      reason,
      action,
    }));
    return res.json({
      success: true,
      order: { id: result.id, status: result.status, voidReason: result.voidReason },
      pointsRevoked: result.pointsRevoked || 0,
      pointsRestored: result.pointsRestored || 0,
      message: action === 'REFUND' ? 'Refund berhasil dicatat dan stok dikembalikan.' : 'Transaksi berhasil dibatalkan.',
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Transaksi gagal dibatalkan' });
  }
}

router.patch('/:id/refund', authenticateToken, requireRole('OWNER', 'ADMIN', 'CASHIER'), (req, res) => handleOrderReversal(req, res, 'REFUND'));
router.patch('/:id/void', authenticateToken, requireRole('OWNER', 'ADMIN', 'CASHIER'), (req, res) => handleOrderReversal(req, res, 'VOID'));

// POST /api/orders/checkout - Process POS checkout with Points, Cash, QRIS, or Bank Transfer
router.post('/checkout', authenticateToken, staffOnly, checkoutLimiter, validateBody(checkoutSchema), async (req, res) => {
  try {
    const {
      items: submittedItems,
      paidAmount,
      paymentMethod = 'CASH',
      paymentReference = null,
      customerId = null,
      customerName = null,
      customerType = 'RETAIL',
      cashierName = 'Kasir Glosir',
      redeemedPoints = 0,
      discount = 0,
      promoCode: submittedPromoCode = '',
      clientRequestId = null,
      holdOrderId = null,
    } = req.body || {};

    if (!Array.isArray(submittedItems) || !submittedItems.length) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja masih kosong' });
    }

    const orderNumber = createOrderNumber('POS');

    try {
      let items = submittedItems;
      let effectiveCustomerId = customerId;
      let effectiveCustomerName = customerName;
      let effectiveCustomerType = customerType;
      let effectiveDiscount = discount;
      let effectivePromoCode = submittedPromoCode;
      let sourceHold = null;
      const result = await prisma.$transaction(async (transaction) => {
        if (clientRequestId) {
          const existingOrder = await transaction.order.findUnique({
            where: { clientRequestId },
            include: { customer: true, items: true, user: { select: { name: true } }, financeEntries: true },
          });
          if (existingOrder) return formatExistingCheckout(existingOrder);
        }
        if (holdOrderId) {
          sourceHold = await transaction.order.findFirst({
            where: { id: holdOrderId, type: 'STORE', status: 'HOLD' },
            include: { items: true },
          });
          if (!sourceHold) throw Object.assign(new Error('Belanjaan tertahan sudah dipakai atau tidak ditemukan'), { statusCode: 404 });
          const holdMetadata = readHoldMetadata(sourceHold.notes);
          items = sourceHold.items.map((item) => ({
            variantId: item.variantId,
            unitId: item.productUnitId || undefined,
            eventPackageId: item.eventPackageId,
            parcelId: item.parcelId,
            quantity: Number(item.quantity),
          }));
          effectiveCustomerId = sourceHold.customerId || effectiveCustomerId;
          effectiveCustomerName = holdMetadata.customerName || effectiveCustomerName;
          effectiveCustomerType = holdMetadata.customerType || effectiveCustomerType;
          effectiveDiscount = 0;
          effectivePromoCode = holdMetadata.promoCode || effectivePromoCode;
        }
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
        // Batch-fetch every variant in one query instead of one findUnique per
        // cart line — same connection, so N sequential reads become 1.
        const variantIds = [...new Set(items.filter((item) => item.variantId).map((item) => item.variantId))];
        const variantRecords = variantIds.length ? await transaction.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { include: { category: true } } },
        }) : [];
        const variantById = new Map(variantRecords.map((variant) => [variant.id, variant]));
        const variants = items.map((item) => (item.variantId ? variantById.get(item.variantId) || null : null));

        // FASE 4: Fetch ProductUnits for unit-based validation if unitId provided
        const unitIds = [...new Set(items.filter((item) => item.unitId).map((item) => item.unitId))];
        const productUnits = unitIds.length ? await transaction.productUnit.findMany({
          where: { id: { in: unitIds }, isActive: true },
        }) : [];
        const unitById = new Map(productUnits.map((unit) => [unit.id, unit]));

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
            const unitPrice = Number(eventPackage.price);
            return { eventPackage, quantity, unitPrice, total: unitPrice * quantity };
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
            const unitPrice = Number(parcel.price);
            return { parcel, quantity, unitPrice, total: unitPrice * quantity };
          }
          const variant = variants[index];
          const quantity = Number(item.quantity);
          if (!variant || !Number.isInteger(quantity) || quantity < 1) {
            throw new Error('Produk atau jumlah beli tidak valid');
          }
          
          // FASE 4: If unitId provided, validate unit-based stock instead of variant stock
          if (item.unitId) {
            const unit = unitById.get(item.unitId);
            if (!unit || unit.productId !== variant.productId) {
              throw new Error(`Unit produk ${variant.product.name} tidak ditemukan`);
            }
            const variantQuantity = quantity * Number(unit.conversionToBase) / Number(variant.conversionToBase);
            if (!Number.isFinite(variantQuantity) || variantQuantity <= 0 || !validateStockAvailability(variant.stockQty, variantQuantity)) {
              throw new Error(`Stok unit ${unit.name} untuk ${variant.product.name} tidak mencukupi`);
            }
            const unitPrice = effectiveCustomerType === 'WHOLESALE' && unit.wholesalePrice != null
              ? Number(unit.wholesalePrice)
              : Number(unit.sellPrice);
            if (!Number.isFinite(unitPrice)) throw new Error(`Harga produk ${variant.product.name} tidak valid`);
            return {
              variant,
              quantity,
              stockQuantity: variantQuantity,
              unitPrice,
              basePrice: Number(unit.basePrice),
              productUnit: unit,
              unitId: item.unitId,
              total: unitPrice * quantity,
            };
          }
          
          // Fallback: Original variant-based validation
          if (!variant.isActive || variant.stockQty < quantity) {
            throw new Error(`Stok produk ${variant.product.name} tidak mencukupi`);
          }
          const unitPrice = effectiveCustomerType === 'WHOLESALE' && variant.wholesalePrice != null
            ? Number(variant.wholesalePrice)
            : Number(variant.sellPrice);
          if (!Number.isFinite(unitPrice)) throw new Error(`Harga produk ${variant.product.name} tidak valid`);
          return { variant, quantity, stockQuantity: quantity, unitPrice, basePrice: Number(variant.basePrice), total: unitPrice * quantity };
        });

        const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
        const promoResult = effectivePromoCode
          ? await validatePromoCode(transaction, effectivePromoCode, subtotal)
          : null;

        let linkedCustomerId = effectiveCustomerId;
        if (!linkedCustomerId && effectiveCustomerName && effectiveCustomerName !== 'Pelanggan Umum') {
          const existingCust = await transaction.customer.findFirst({
            where: { name: { equals: effectiveCustomerName, mode: 'insensitive' } },
          });
          linkedCustomerId = existingCust?.id;
          if (!linkedCustomerId && paymentMethod === 'DEBT') {
            const newCustomer = await transaction.customer.create({ data: { name: effectiveCustomerName } });
            linkedCustomerId = newCustomer.id;
          }
        }
        if (paymentMethod === 'DEBT' && !linkedCustomerId) {
          throw new Error('Pelanggan wajib dipilih untuk transaksi bon/utang');
        }

        const appSettings = await getAppSettings(transaction);
        if (!appSettings.checkout.paymentMethods.includes(paymentMethod)) {
          throw Object.assign(new Error('Metode pembayaran ini sedang tidak diaktifkan.'), { statusCode: 400 });
        }
        const manualDiscount = Math.min(Number(effectiveDiscount) || 0, subtotal);
        const cashierDiscountLimit = Math.min(
          subtotal * Number(appSettings.cashierDiscount.maxPercent || 0) / 100,
          Number(appSettings.cashierDiscount.maxAmount || 0),
        );
        if (manualDiscount > cashierDiscountLimit) {
          if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
            throw Object.assign(new Error('Diskon melebihi batas kasir. Minta Owner atau Admin menyetujui.'), { statusCode: 403 });
          }
          if (!String(req.body?.discountReason || '').trim()) {
            throw Object.assign(new Error('Alasan diskon di atas batas wajib diisi.'), { statusCode: 400 });
          }
        }

        const requestedRedeemedPoints = Number(redeemedPoints) || 0;
        if (requestedRedeemedPoints > 0 && !linkedCustomerId) {
          throw new Error('Pilih pelanggan untuk menggunakan poin.');
        }
        if (requestedRedeemedPoints > 0) {
          const pointCustomer = await transaction.customer.findUnique({
            where: { id: linkedCustomerId },
            select: { points: true },
          });
          if (!pointCustomer || Number(pointCustomer.points) < requestedRedeemedPoints) {
            throw new Error('Saldo poin pelanggan tidak mencukupi.');
          }
        }
        const pointDiscount = requestedRedeemedPoints;
        const promoDiscount = promoResult?.discountAmount || 0;
        if (manualDiscount + promoDiscount + pointDiscount > subtotal) {
          throw new Error('Total diskon melebihi subtotal transaksi.');
        }
        const discountAmount = manualDiscount + promoDiscount + pointDiscount;
        const total = Math.max(subtotal - discountAmount, 0);

        // FASE 5: Cek jual rugi (harga jual < modal)
        const lossItems = checkSellBelowCost(
          lines.map((line) => ({
            name: line.productUnit ? `${line.variant.product.name} (${line.productUnit.name})` : line.variant?.product.name || line.eventPackage?.name || line.parcel.name,
            unitPrice: line.unitPrice,
            basePrice: Number(line.basePrice ?? line.variant?.basePrice ?? 0),
          }))
        );

        const saleCategories = [...new Set(lines.flatMap((line) => {
          if (line.variant) return [line.variant.product.category?.name];
          if (line.eventPackage) return line.eventPackage.items.map((item) => item.variant.product.category?.name);
          return line.parcel.items.map((item) => item.variant.product.category?.name);
        }).filter(Boolean))];

        let paid = Number(paidAmount);
        if (paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') {
          paid = total;
        }

        if (paymentMethod !== 'DEBT' && (!Number.isFinite(paid) || paid < total)) {
          throw new Error('Uang dibayar kurang dari total belanja');
        }
        if (paymentMethod === 'DEBT') paid = 0;

        const loyaltyRule = await getActiveLoyaltyRule(transaction);
        const earnedPoints = calculatePoints(total, loyaltyRule);
        const pointsDelta = earnedPoints - requestedRedeemedPoints;

        const order = await transaction.order.create({
          data: {
            orderNumber,
            clientRequestId,
            type: 'STORE',
            status: 'COMPLETED',
            user: { connect: { id: req.user.id } },
            customer: linkedCustomerId ? { connect: { id: linkedCustomerId } } : undefined,
            subtotal,
            discount: discountAmount,
            total,
            paymentMethod,
            paymentStatus: paymentMethod === 'DEBT' ? 'UNPAID' : 'PAID',
            paidAmount: paid,
            pointsAwarded: earnedPoints,
            pointsRedeemed: requestedRedeemedPoints,
            notes: `Points: +${earnedPoints} / -${requestedRedeemedPoints}`,
            items: {
              create: lines.map((line) => ({
                product: line.variant ? { connect: { id: line.variant.productId } } : undefined,
                variant: line.variant ? { connect: { id: line.variant.id } } : undefined,
                productUnit: line.productUnit ? { connect: { id: line.productUnit.id } } : undefined,
                eventPackage: line.eventPackage ? { connect: { id: line.eventPackage.id } } : undefined,
                parcel: line.parcel ? { connect: { id: line.parcel.id } } : undefined,
                name: line.productUnit ? `${line.variant.product.name} (${line.productUnit.name})` : line.variant?.product.name || line.eventPackage?.name || line.parcel.name,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                total: line.total,
              })),
            },
          },
          include: { customer: true },
        });
        if (promoResult) await recordPromoUse(transaction, promoResult.promo);

        if (sourceHold) {
          await transaction.order.update({
            where: { id: sourceHold.id },
            data: { status: 'CANCELLED', notes: 'HOLD_CART:RESUMED' },
          });
        }

        // FASE 5: Catat AuditLog jika ada barang dijual rugi
        if (lossItems.length > 0) {
          await transaction.auditLog.create({
            data: {
              entityType: 'Order',
              entityId: order.id,
              field: 'SELL_BELOW_COST',
              oldValue: 'NORMAL',
              newValue: JSON.stringify(lossItems),
              changedById: req.user.id,
            },
          });
        }
        if (manualDiscount > cashierDiscountLimit) {
          await writeAuditLog({
            client: transaction,
            entityType: 'Order',
            entityId: order.id,
            field: 'DISCOUNT_OVERRIDE',
            oldValue: { discount: cashierDiscountLimit },
            newValue: { discount: manualDiscount, reason: String(req.body.discountReason).trim() },
            changedById: req.user.id,
          });
        }

        // Track quantity AND productId per variant so we don't need to
        // re-fetch the variant again just to log the stock movement.
        const stockDeductions = new Map();
        const addDeduction = (variantId, productId, quantity) => {
          const current = stockDeductions.get(variantId) || { quantity: 0, productId };
          current.quantity += quantity;
          stockDeductions.set(variantId, current);
        };
        for (const line of lines) {
          if (line.variant) {
            addDeduction(line.variant.id, line.variant.productId, line.stockQuantity ?? line.quantity);
          } else if (line.eventPackage) {
            for (const packageItem of line.eventPackage.items) {
              addDeduction(packageItem.variant.id, packageItem.variant.productId, packageItem.quantity * line.quantity);
            }
          } else {
            for (const parcelItem of line.parcel.items) {
              addDeduction(parcelItem.variant.id, parcelItem.variant.productId, parcelItem.quantity * line.quantity);
            }
          }
        }
        // updateMany with a stockQty >= quantity guard makes the check and the
        // decrement ATOMIC in one query, instead of a separate read (which
        // could be stale) followed by an unconditional write. This also cuts
        // the round trips per item from 3 down to 1.
        const stockMovements = [];
        for (const [variantId, { quantity, productId }] of stockDeductions) {
          const updateResult = await transaction.productVariant.updateMany({
            where: { id: variantId, stockQty: { gte: quantity } },
            data: { stockQty: { decrement: quantity } },
          });
          if (updateResult.count === 0) throw new Error('Stok berubah. Silakan ulangi checkout.');
          stockMovements.push({
            productId,
            variantId,
            type: 'OUT',
            quantity,
            note: 'Penjualan kasir POS',
            reference: orderNumber,
            changedById: req.user.id,
          });
        }
        if (stockMovements.length) {
          await transaction.stockMovement.createMany({ data: stockMovements });
        }

        const financeDesc = paymentReference
          ? `Penjualan kasir ${orderNumber} (${paymentMethod}) Ref: ${paymentReference}`
          : `Penjualan kasir ${orderNumber} (${paymentMethod})`;
        const [defaultAccount, salesCategory] = await Promise.all([
          transaction.financeAccount.upsert({
            where: { id: 'finance-default-cash' },
            create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH', startBalance: 0 },
            update: {},
          }),
          transaction.financeCategory.upsert({
            where: { name_type: { name: 'Penjualan', type: 'INCOME' } },
            create: { name: 'Penjualan', type: 'INCOME', isDefault: true },
            update: {},
          }),
        ]);

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
              order: { connect: { id: order.id } },
              customer: { connect: { id: linkedCustomerId } },
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
          const pointRes = await updateCustomerPoints(linkedCustomerId, pointsDelta, transaction);
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
          customer: order.customer ? { id: order.customer.id, name: order.customer.name, phone: order.customer.phone } : effectiveCustomerName ? { name: effectiveCustomerName } : null,
          cashierName,
          earnedPoints,
          redeemedPoints: Number(redeemedPoints) || 0,
          previousPoints: pointDetails.previousPoints,
          currentPoints: pointDetails.currentPoints,
          items: lines.map((line) => ({
            name: line.productUnit ? `${line.variant.product.name} (${line.productUnit.name})` : line.variant?.product.name || line.eventPackage?.name || line.parcel.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
          })),
          createdAt: order.createdAt,
        };

        return orderDetail;
      }, { maxWait: 10000, timeout: 30000 });

      return res.status(201).json({ success: true, ...result });
    } catch (dbError) {
      if (dbError.code === 'P2002' && clientRequestId) {
        const existingOrder = await prisma.order.findUnique({
          where: { clientRequestId },
          include: { customer: true, items: true, user: { select: { name: true } }, financeEntries: true },
        });
        if (existingOrder) return res.json({ success: true, ...formatExistingCheckout(existingOrder) });
      }
      console.error('Database checkout failed:', dbError.code || 'UNKNOWN', dbError.message);
      const isDatabaseError = Boolean(dbError.code && /^P\d{4}$/.test(dbError.code));
      return res.status(dbError.statusCode || (isDatabaseError ? 503 : 400)).json({
        success: false,
        message: dbError.statusCode
          ? dbError.message
          : isDatabaseError
            ? 'Database transaksi sedang bermasalah. Coba ulangi beberapa detik lagi.'
            : dbError.message || 'Transaksi gagal disimpan.',
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Transaksi gagal disimpan' });
  }
});

export default router;
