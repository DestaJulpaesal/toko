import prisma from '../config/db.js';

/**
 * FASE 5: Loyalty Points Service
 * Mengelola poin loyalitas pelanggan: hitung, tambah, kurangi, tukar.
 */

/**
 * Ambil aturan poin yang aktif (hanya 1 row)
 */
export async function getActiveLoyaltyRule() {
  let rule = await prisma.loyaltyRule.findFirst({ where: { isActive: true } });
  if (!rule) {
    // Buat default jika belum ada
    rule = await prisma.loyaltyRule.create({
      data: {
        pointsPerRp100k: 100,
        minTransactionAmount: 100000,
        pointsPerRp: 0.001,
        isActive: true,
      },
    });
  }
  return rule;
}

/**
 * Hitung poin dari nominal transaksi berdasarkan aturan loyalitas
 * @param {number} totalAmount - Total transaksi (Rp)
 * @param {object} rule - Aturan poin aktif
 * @returns {number} Jumlah poin yang didapat
 */
export function calculatePoints(totalAmount, rule) {
  const amount = Number(totalAmount) || 0;
  const minAmount = Number(rule.minTransactionAmount) || 100000;
  const pointsPer100k = Number(rule.pointsPerRp100k) || 100;

  if (amount < minAmount) return 0;

  // Hitung poin: per kelipatan Rp100.000
  const kelipatan = Math.floor(amount / 100000);
  return kelipatan * pointsPer100k;
}

/**
 * Tambah poin ke customer setelah transaksi COMPLETED
 * @param {string} customerId
 * @param {number} points - Jumlah poin yang ditambahkan
 * @param {string} orderId - ID order untuk tracking
 * @param {object} tx - Prisma transaction (optional)
 * @returns {object} Updated customer
 */
export async function awardPoints(customerId, points, orderId, tx = null) {
  if (!customerId || points <= 0) return null;

  const db = tx || prisma;
  const customer = await db.customer.update({
    where: { id: customerId },
    data: { points: { increment: points } },
  });

  return customer;
}

/**
 * Kembalikan poin saat order di-VOID
 * @param {string} customerId
 * @param {number} points - Jumlah poin yang dikembalikan (dikurangi)
 * @param {string} orderId
 * @param {object} tx - Prisma transaction (optional)
 * @returns {object} Updated customer
 */
export async function revokePoints(customerId, points, orderId, tx = null) {
  if (!customerId || points <= 0) return null;

  const db = tx || prisma;

  // Pastikan customer punya cukup poin (jangan sampai negatif)
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;

  const actualDeduction = Math.min(points, customer.points);

  const updated = await db.customer.update({
    where: { id: customerId },
    data: { points: { decrement: actualDeduction } },
  });

  return updated;
}

/**
 * Tukar poin menjadi diskon
 * @param {string} customerId
 * @param {number} pointsToRedeem
 * @param {object} rule - Aturan loyalitas aktif
 * @returns {object} { discountAmount, pointsUsed }
 */
export async function redeemPoints(customerId, pointsToRedeem) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error('Pelanggan tidak ditemukan.');
  if (customer.points < pointsToRedeem) {
    throw new Error(`Poin tidak cukup. Saldo: ${customer.points} poin, diminta: ${pointsToRedeem} poin.`);
  }

  // 1 poin = Rp1 (bisa diubah di rule nanti)
  const discountAmount = pointsToRedeem;

  await prisma.customer.update({
    where: { id: customerId },
    data: { points: { decrement: pointsToRedeem } },
  });

  return { discountAmount, pointsUsed: pointsToRedeem };
}

/**
 * Cek apakah ada item yang dijual di bawah harga modal
 * @param {Array} items - Array of { unitPrice, basePrice, name }
 * @returns {Array} List barang yang dijual rugi
 */
export function checkSellBelowCost(items) {
  return items
    .filter((item) => {
      const sellPrice = Number(item.unitPrice || item.sellPrice || 0);
      const basePrice = Number(item.basePrice || item.purchasePrice || 0);
      return basePrice > 0 && sellPrice < basePrice;
    })
    .map((item) => ({
      name: item.name,
      sellPrice: Number(item.unitPrice || item.sellPrice || 0),
      basePrice: Number(item.basePrice || item.purchasePrice || 0),
      loss: Number(item.basePrice || item.purchasePrice || 0) - Number(item.unitPrice || item.sellPrice || 0),
    }));
}

/**
 * Ambil produk yang mendekati kadaluarsa
 * @param {number} withinDays - Dalam berapa hari ke depan
 * @returns {Array} List produk yang akan kadaluarsa
 */
export async function getExpiringProducts(withinDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);

  const units = await prisma.productUnit.findMany({
    where: {
      expiryDate: { not: null, lte: cutoffDate },
      isActive: true,
    },
    include: {
      product: { select: { id: true, name: true, sku: true, baseStockQty: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });

  return units.map((unit) => {
    const daysLeft = Math.ceil((new Date(unit.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return {
      unitId: unit.id,
      unitName: unit.name,
      productId: unit.product.id,
      productName: unit.product.name,
      productSku: unit.product.sku,
      expiryDate: unit.expiryDate,
      daysLeft,
      isExpired: daysLeft <= 0,
      urgency: daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 7 ? 'CRITICAL' : daysLeft <= 30 ? 'WARNING' : 'OK',
    };
  });
}

/**
 * Laporan barang paling untung & paling laku
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} limit - Berapa item yang ditampilkan
 * @returns {object} { mostProfitable, bestSelling }
 */
export async function getProductPerformance(startDate, endDate, limit = 20) {
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Query order items yang COMPLETED (bukan VOID)
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        status: 'COMPLETED',
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      productId: { not: null },
    },
    include: {
      product: { select: { name: true, sku: true } },
      variant: { select: { basePrice: true, sellPrice: true } },
    },
  });

  // Group by product
  const productMap = new Map();

  for (const item of orderItems) {
    const key = item.productId;
    if (!productMap.has(key)) {
      productMap.set(key, {
        productId: key,
        productName: item.product?.name || item.name,
        productSku: item.product?.sku || '-',
        totalQty: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        transactionCount: 0,
      });
    }

    const data = productMap.get(key);
    const qty = Number(item.quantity);
    const revenue = Number(item.total);
    const basePrice = Number(item.variant?.basePrice || 0);
    const cost = basePrice * qty;

    data.totalQty += qty;
    data.totalRevenue += revenue;
    data.totalCost += cost;
    data.totalProfit += revenue - cost;
    data.transactionCount += 1;
  }

  const allProducts = Array.from(productMap.values()).map((p) => ({
    ...p,
    profitMargin: p.totalRevenue > 0 ? Math.round((p.totalProfit / p.totalRevenue) * 100) : 0,
  }));

  // Sort by profit descending
  const mostProfitable = [...allProducts]
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, limit);

  // Sort by quantity descending
  const bestSelling = [...allProducts]
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, limit);

  // Barang yang dijual rugi
  const lossItems = allProducts
    .filter((p) => p.totalProfit < 0)
    .sort((a, b) => a.totalProfit - b.totalProfit);

  return { mostProfitable, bestSelling, lossItems, totalProducts: allProducts.length };
}
