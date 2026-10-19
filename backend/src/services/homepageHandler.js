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
  return {
    id: product.id,
    name: product.name,
    category: product.category?.name || 'Tanpa kategori',
    imageUrl: product.imageUrl || null,
    price: Number(product.variants[0]?.sellPrice || 0),
    originalPrice: null,
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
      where: {
        status: 'ACTIVE',
        OR: [{ isFlashSale: true }, { isBestseller: true }, { isRecommended: true }],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
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

  return {
    success: true,
    categories: categories.map(formatCategory),
    promos: promos.map(formatPromo),
    flashSaleProducts: selectProducts('isFlashSale'),
    bestsellerProducts: selectProducts('isBestseller'),
    recommendedProducts: selectProducts('isRecommended'),
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
