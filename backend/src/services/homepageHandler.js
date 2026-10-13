function formatCategory(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    productCount: category._count?.products || 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function formatPromo(promo) {
  return {
    id: promo.id,
    name: promo.name,
    slug: promo.slug,
    description: promo.description || '',
    discountType: promo.discountType,
    discountValue: Number(promo.discountValue || 0),
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    isActive: promo.isActive,
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt,
  };
}

function formatHomepageProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category?.name || 'Sembako',
    imageUrl: product.imageUrl || null,
    price: Number(product.variants[0]?.sellPrice || 0),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : 0,
  };
}

export function createHomepageHandler(db) {
  return async (req, res) => {
    try {
      const now = new Date();
      const [categories, promos, products] = await Promise.all([
        db.category.findMany({
          include: { _count: { select: { products: true } } },
          orderBy: { name: 'asc' },
        }),
        db.promoCampaign.findMany({
          where: {
            isActive: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.product.findMany({
          where: {
            status: 'ACTIVE',
            OR: [{ isFlashSale: true }, { isBestseller: true }, { isRecommended: true }],
          },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            originalPrice: true,
            createdAt: true,
            isFlashSale: true,
            isBestseller: true,
            isRecommended: true,
            category: { select: { name: true } },
            variants: {
              where: { isActive: true, isDefault: true },
              take: 1,
              select: { sellPrice: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const selectProducts = (flag) => products
        .filter((product) => product[flag])
        .slice(0, 10)
        .map(formatHomepageProduct);

      return res.json({
        success: true,
        categories: categories.map(formatCategory),
        promos: promos.map(formatPromo),
        flashSaleProducts: selectProducts('isFlashSale'),
        bestsellerProducts: selectProducts('isBestseller'),
        recommendedProducts: selectProducts('isRecommended'),
      });
    } catch (error) {
      console.error('Homepage data failed to load:', error.message);
      return res.status(503).json({ success: false, message: 'Data homepage gagal dimuat' });
    }
  };
}
