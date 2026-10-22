export async function validatePromoCode(client, code, subtotal, lines = []) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) throw new Error('Masukkan kode promo.');
  const promo = await client.promoCampaign.findUnique({ where: { code: normalizedCode } });
  if (!promo || !promo.isActive) throw new Error('Kode promo tidak tersedia.');

  const categoryIds = promo.categoryIds || [];
  const productIds = promo.productIds || [];
  const hasScope = categoryIds.length > 0 || productIds.length > 0;
  const eligibleSubtotal = hasScope
    ? lines.reduce((sum, line) => {
      const eligible = productIds.includes(line.productId)
        || categoryIds.includes(line.categoryId);
      return eligible ? sum + Number(line.total || 0) : sum;
    }, 0)
    : Number(subtotal);

  if (hasScope && eligibleSubtotal <= 0) {
    throw new Error('Promo ini hanya berlaku untuk produk atau kategori tertentu yang belum ada di keranjang.');
  }

  const now = new Date();
  if ((promo.startsAt && promo.startsAt > now) || (promo.endsAt && promo.endsAt < now)) {
    throw new Error('Promo belum berlaku atau sudah berakhir.');
  }
  if (Number(promo.usageLimit) > 0 && promo.usedCount >= promo.usageLimit) {
    throw new Error('Kuota promo sudah habis.');
  }
  if (Number(promo.minPurchase || 0) > eligibleSubtotal) {
    throw new Error(`Minimal belanja untuk promo ini Rp${Number(promo.minPurchase).toLocaleString('id-ID')}.`);
  }

  const rawDiscount = promo.discountType === 'PERCENT'
    ? eligibleSubtotal * Number(promo.discountValue) / 100
    : Number(promo.discountValue);
  const cappedDiscount = promo.maxDiscount == null ? rawDiscount : Math.min(rawDiscount, Number(promo.maxDiscount));
  return { promo, discountAmount: Math.min(Math.round(cappedDiscount), eligibleSubtotal) };
}

export async function recordPromoUse(transaction, promo) {
  const now = new Date();
  const result = await transaction.promoCampaign.updateMany({
    where: {
      id: promo.id,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        {
          OR: promo.usageLimit == null
            ? [{ usageLimit: null }]
            : [{ usageLimit: null }, { usedCount: { lt: promo.usageLimit } }],
        },
      ],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error('Promo baru saja tidak tersedia. Periksa kembali kode promo.');
}
