function formatCategory(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    imageUrl: category.imageUrl || null,
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
  const variant = product.variants?.[0];
  const price = Number(variant?.sellPrice || 0);
  const originalPrice = product.originalPrice == null ? null : Number(product.originalPrice);
  const hasDiscount = originalPrice !== null && originalPrice > price;

  return {
    id: product.id,
    variantId: variant?.id,
    name: product.name,
    category: product.category?.name || 'Tanpa kategori',
    imageUrl: product.imageUrl || null,
    price,
    originalPrice: hasDiscount ? originalPrice : null,
    discountPercent: hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    stock: Number(variant?.stockQty || 0),
  };
}

const HOMEPAGE_CACHE_TTL_MS = 30_000;
const homepageCacheByDb = new WeakMap();

function getHomepageCache(db) {
  let cache = homepageCacheByDb.get(db);
  if (!cache) {
    cache = { data: null, expiresAt: 0, pending: null };
    homepageCacheByDb.set(db, cache);
  }
  return cache;
}

async function loadHomepageData(db) {
  const now = new Date();
  const salesSince = new Date(now);
  salesSince.setDate(salesSince.getDate() - 90);
  const [categories, promos, products, completedOrderItems] = await Promise.all([
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
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        discountType: true,
        discountValue: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        createdAt: true,
        originalPrice: true,
        isFlashSale: true,
        isBestseller: true,
        isRecommended: true,
        isFeatured: true,
        category: { select: { name: true } },
        variants: {
          where: { isActive: true, isDefault: true },
          take: 1,
          select: { id: true, sellPrice: true, stockQty: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.orderItem.findMany({
      where: {
        productId: { not: null },
        order: { status: 'COMPLETED', createdAt: { gte: salesSince } },
      },
      select: { productId: true, quantity: true },
    }),
  ]);

  const availableProducts = products.filter((product) => (
    product.variants?.[0] && Number(product.variants[0].stockQty || 0) > 0
  ));
  const selectProducts = (matches) => matches.map(formatHomepageProduct);
  const flashSaleProducts = selectProducts(availableProducts.filter((product) => (
    product.isFlashSale
    && product.originalPrice != null
    && Number(product.originalPrice) > Number(product.variants[0].sellPrice || 0)
  )));

  const soldQuantities = new Map();
  for (const item of completedOrderItems) {
    if (!item.productId) continue;
    soldQuantities.set(
      item.productId,
      (soldQuantities.get(item.productId) || 0) + Number(item.quantity || 0),
    );
  }
  const productsById = new Map(availableProducts.map((product) => [product.id, product]));
  const salesRankedProducts = [...soldQuantities.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([productId]) => productsById.get(productId))
    .filter(Boolean);
  const bestsellerProducts = salesRankedProducts.length > 0
    ? selectProducts(salesRankedProducts)
    : selectProducts(availableProducts.filter((product) => product.isBestseller));

  const markedRecommendations = availableProducts.filter((product) => product.isRecommended);
  const recommendations = markedRecommendations.length > 0
    ? markedRecommendations
    : [...availableProducts].sort((first, second) => (
      Number(second.isFeatured) - Number(first.isFeatured)
      || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
    ));

  return {
    success: true,
    categories: categories.map(formatCategory),
    promos: promos.map(formatPromo),
    flashSaleProducts,
    bestsellerProducts,
    recommendedProducts: selectProducts(recommendations),
  };
}

function refreshHomepageCache(db, cache) {
  if (!cache.pending) {
    cache.pending = loadHomepageData(db)
      .then((data) => {
        cache.data = data;
        cache.expiresAt = Date.now() + HOMEPAGE_CACHE_TTL_MS;
        return data;
      })
      .finally(() => {
        cache.pending = null;
      });
  }
  return cache.pending;
}

export function warmHomepageCache(db) {
  return refreshHomepageCache(db, getHomepageCache(db));
}

export function invalidateHomepageCache(db) {
  homepageCacheByDb.delete(db);
}

export function createHomepageHandler(db) {
  return async (req, res) => {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    const cache = getHomepageCache(db);
    if (cache.data) {
      if (Date.now() >= cache.expiresAt && !cache.pending) {
        refreshHomepageCache(db, cache).catch((error) => {
          console.error('Homepage cache refresh failed:', error.message);
        });
      }
      return res.json(cache.data);
    }

    try {
      return res.json(await refreshHomepageCache(db, cache));
    } catch (error) {
      console.error('Homepage data failed to load:', error.message);
      return res.status(503).json({ success: false, message: 'Data homepage gagal dimuat' });
    }
  };
}
