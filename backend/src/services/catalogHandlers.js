import {
  formatEventPackage,
  formatProduct,
  getAudience,
  isOwnerAudience,
} from './catalogSerializers.js';

// Handler untuk endpoint katalog yang boleh dibuka TANPA login.
// `db` disuntikkan (dependency injection) supaya handler bisa dites tanpa database asli.
// Pasang middleware `softAuth` di depan handler ini, supaya `req.user` terisi bila ada token valid.
export function createCatalogHandlers(db) {
  const listProducts = async (req, res) => {
    try {
      // `?all=true` (termasuk produk Draft) hanya dihormati untuk OWNER/ADMIN.
      // Untuk selain itu parameternya diabaikan, bukan ditolak, supaya halaman publik tidak error.
      const includeDrafts = req.query.all === 'true' && isOwnerAudience(req.user);
      const products = await db.product.findMany({
        where: includeDrafts ? { status: { not: 'HIDDEN' } } : { status: 'ACTIVE' },
        include: { category: true, variants: { where: { isActive: true }, orderBy: { isDefault: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      });
      const audience = getAudience(req.user);

      return res.json({
        success: true,
        source: 'database',
        products: products.map((product) => formatProduct(product, audience)),
      });
    } catch (error) {
      console.error('Product database unavailable:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Database produk tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
      });
    }
  };

  const getProduct = async (req, res) => {
    try {
      const product = await db.product.findUnique({
        where: { id: req.params.id },
        include: { category: true, variants: { where: { isDefault: true, isActive: true }, take: 1 } },
      });

      // Produk Draft/Hidden tidak boleh terlihat oleh pengunjung, walaupun ID-nya diketahui.
      if (!product || (product.status !== 'ACTIVE' && !isOwnerAudience(req.user))) {
        return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
      }

      return res.json({
        success: true,
        source: 'database',
        product: formatProduct(product, getAudience(req.user)),
      });
    } catch (error) {
      console.error('Product detail query failed:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Database produk tidak tersedia. Sinkronisasi DB perlu dijalankan terlebih dahulu.',
      });
    }
  };

  // Hanya ambil kolom yang dibutuhkan tampilan. Harga modal tidak pernah ikut dibaca dari database.
  const eventPackageSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    imageUrl: true,
    price: true,
    isManualPrice: true,
    isCustom: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    items: {
      select: {
        id: true,
        eventPackageId: true,
        variantId: true,
        quantity: true,
        variant: {
          select: {
            id: true,
            productId: true,
            name: true,
            sellPrice: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    },
  };

  const listEventPackages = async (req, res) => {
    try {
      const packages = await db.eventPackage.findMany({
        where: { isActive: true },
        select: eventPackageSelect,
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ success: true, packages: packages.map(formatEventPackage) });
    } catch (error) {
      console.error('Event package list failed:', error.message);
      return res.status(503).json({ success: false, message: 'Daftar paket acara belum dapat dimuat.' });
    }
  };

  const getEventPackage = async (req, res) => {
    try {
      const item = await db.eventPackage.findFirst({
        where: { OR: [{ id: req.params.id }, { slug: req.params.id }], isActive: true },
        select: eventPackageSelect,
      });
      if (!item) return res.status(404).json({ success: false, message: 'Paket acara tidak ditemukan' });
      return res.json({ success: true, package: formatEventPackage(item) });
    } catch (error) {
      console.error('Event package detail failed:', error.message);
      return res.status(503).json({ success: false, message: 'Detail paket acara belum dapat dimuat.' });
    }
  };

  return { listProducts, getProduct, listEventPackages, getEventPackage };
}
