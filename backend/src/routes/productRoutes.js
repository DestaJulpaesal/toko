import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole, softAuth } from '../middleware/auth.js';
import { createCatalogHandlers } from '../services/catalogHandlers.js';
import { AUDIENCE, formatProduct } from '../services/catalogSerializers.js';
import { validateBody, productCreateSchema, productUpdateSchema, productBulkSchema } from '../middleware/security.js';

const router = express.Router();
const catalog = createCatalogHandlers(prisma);

const statusToDb = { Aktif: 'ACTIVE', 'Stok menipis': 'ACTIVE', Draft: 'DRAFT' };
const normalizeCategoryName = (name) => String(name || '').trim();
async function findCategory(name) {
  const normalizedName = normalizeCategoryName(name);
  const category = await prisma.category.findFirst({ where: { name: normalizedName } });
  if (category || normalizedName.toLowerCase() !== 'glosir') return category;
  // Backward compatibility for older bulk presets created before Glosir was renamed.
  return prisma.category.findFirst({ where: { name: 'Warung' } });
}

// Publik, tetapi isinya menyesuaikan siapa yang membuka (lihat services/catalogSerializers.js).
router.get('/', softAuth, catalog.listProducts);
router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(productCreateSchema), async (req, res) => {
  try {
    const { name, sku, barcode, category, price, wholesalePrice, purchasePrice, originalPrice, stock, status = 'Aktif', isQuickAccess = false, imageUrl } = req.body || {};

    const categoryRecord = await findCategory(category);
    if (!categoryRecord) return res.status(400).json({ success: false, message: `Kategori ${category} belum tersedia` });

    const calculatedBase = purchasePrice !== undefined ? Number(purchasePrice) : (originalPrice ? Number(originalPrice) : Number(price));
    const internalSku = String(sku || `GLS-${Date.now()}`).trim();
    const product = await prisma.product.create({
      data: {
        sku: internalSku,
        name: String(name).trim(),
        slug: `${String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        categoryId: categoryRecord.id,
        status: statusToDb[status] || 'ACTIVE',
        stockWarning: 5,
        isQuickAccess: Boolean(isQuickAccess),
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        variants: { create: { name: 'Kemasan utama', sku: `${internalSku}-DEFAULT`, barcode: barcode ? String(barcode).trim() : null, basePrice: calculatedBase, sellPrice: Number(price), wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null, stockQty: Number(stock), unit: 'unit', isDefault: true } },
      },
      include: { category: true, variants: { where: { isActive: true }, orderBy: { isDefault: 'desc' } } },
    });
    return res.status(201).json({ success: true, product: formatProduct(product, AUDIENCE.OWNER) });  } catch (error) {
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'SKU atau produk sudah digunakan' : 'Produk gagal disimpan' });
  }
});

router.post('/bulk', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(productBulkSchema), async (req, res) => {
  try {
    const { products } = req.body || {};

    const categoryNames = [...new Set(products.map((item) => normalizeCategoryName(item.category).toLowerCase() === 'glosir' ? 'Warung' : normalizeCategoryName(item.category)).filter(Boolean))];
    const categoryRecords = await prisma.category.findMany({ where: { name: { in: categoryNames } } });
    const categoriesByName = new Map(categoryRecords.map((category) => [category.name, category]));

    const created = await prisma.$transaction(async (transaction) => {
      const result = [];
      for (const item of products) {
        if (!item.name || !item.category || item.price === undefined || item.stock === undefined) {
          throw new Error(`Data produk ${item.name || '(tanpa nama)'} belum lengkap`);
        }
        const requestedCategory = normalizeCategoryName(item.category).toLowerCase() === 'glosir' ? 'Warung' : normalizeCategoryName(item.category);
        const categoryRecord = categoriesByName.get(requestedCategory);
        if (!categoryRecord) throw new Error(`Kategori ${item.category} belum tersedia`);

        const internalSku = String(item.sku || `GLS-${Date.now()}-${result.length + 1}`).trim();
        const product = await transaction.product.create({
          data: {
            sku: internalSku,
            name: String(item.name).trim(),
            slug: `${String(item.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${result.length}`,
            categoryId: categoryRecord.id,
            status: statusToDb[item.status] || 'ACTIVE',
            stockWarning: 5,
            variants: { create: {
              name: String(item.unit || 'Kemasan utama'),
              sku: `${internalSku}-DEFAULT`,
              barcode: item.barcode ? String(item.barcode).trim() : null,
              basePrice: item.purchasePrice !== undefined ? Number(item.purchasePrice) : (item.originalPrice ? Number(item.originalPrice) : Number(item.price)),
              sellPrice: Number(item.price),
              wholesalePrice: item.wholesalePrice ? Number(item.wholesalePrice) : null,
              stockQty: Number(item.stock),
              unit: String(item.unit || 'unit'),
              isDefault: true,
            } },
          },
          include: { category: true, variants: { where: { isDefault: true }, take: 1 } },
        });
        result.push(formatProduct(product, AUDIENCE.OWNER));      }
      return result;
    }, { maxWait: 10000, timeout: 30000 });

    return res.status(201).json({ success: true, products: created });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'SKU atau barcode sudah digunakan' : error.message || 'Produk gagal disimpan' });
  }
});

router.get('/restock-suggestions', authenticateToken, async (req, res) => {
  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true },
      include: { product: { select: { name: true, stockWarning: true } } },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { type: 'OUT', createdAt: { gte: since }, variantId: { not: null } },
      select: { variantId: true, quantity: true },
    });
    const soldByVariant = new Map();
    for (const movement of movements) soldByVariant.set(movement.variantId, (soldByVariant.get(movement.variantId) || 0) + movement.quantity);
    const suggestions = variants.map((variant) => {
      const averageDailyOut = (soldByVariant.get(variant.id) || 0) / 14;
      const suggestedPurchase = Math.max(Math.ceil(averageDailyOut * 7 - variant.stockQty), 0);
      return {
        variantId: variant.id,
        productName: variant.product.name,
        stockQty: variant.stockQty,
        stockWarning: variant.product.stockWarning,
        averageDailyOut: Number(averageDailyOut.toFixed(2)),
        estimatedDaysLeft: averageDailyOut > 0 ? Number((variant.stockQty / averageDailyOut).toFixed(1)) : null,
        suggestedPurchase,
      };
    }).filter((item) => item.suggestedPurchase > 0 || item.stockQty <= item.stockWarning);
    return res.json({ success: true, suggestions });
  } catch (error) {
    return res.status(503).json({ success: false, message: 'Rekomendasi restock belum dapat dihitung' });
  }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(productUpdateSchema), async (req, res) => {
  try {
    const { name, sku, barcode, category, price, wholesalePrice, purchasePrice, originalPrice, stock, status = 'Aktif', isQuickAccess = false, imageUrl } = req.body || {};
    const [categoryRecord, existing] = await Promise.all([
      findCategory(category),
      prisma.product.findUnique({ where: { id: req.params.id }, include: { category: true, variants: { where: { isDefault: true }, take: 1 } } }),
    ]);
    if (!categoryRecord) return res.status(400).json({ success: false, message: `Kategori ${category} belum tersedia` });
    if (!existing) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    const variant = existing.variants[0];
    const calculatedBase = purchasePrice !== undefined ? Number(purchasePrice) : (originalPrice ? Number(originalPrice) : (variant ? Number(variant.basePrice) : Number(price)));
    const changes = variant ? [
      ['sellPrice', Number(variant.sellPrice), Number(price)],
      ['wholesalePrice', variant.wholesalePrice == null ? null : Number(variant.wholesalePrice), wholesalePrice ? Number(wholesalePrice) : null],
      ['stockQty', variant.stockQty, Number(stock)],
    ].filter(([, oldValue, newValue]) => oldValue !== newValue) : [];
    const updatePromise = prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: String(name).trim(), sku: String(sku).trim(), categoryId: categoryRecord.id, status: statusToDb[status] || 'ACTIVE', isQuickAccess: Boolean(isQuickAccess), imageUrl: imageUrl ? String(imageUrl).trim() : null,
        variants: variant ? { update: { where: { id: variant.id }, data: { basePrice: calculatedBase, sellPrice: Number(price), wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null, stockQty: Number(stock), sku: `${String(sku).trim()}-DEFAULT`, barcode: barcode ? String(barcode).trim() : null } } } : { create: { name: 'Kemasan utama', sku: `${String(sku).trim()}-DEFAULT`, barcode: barcode ? String(barcode).trim() : null, basePrice: calculatedBase, sellPrice: Number(price), wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null, stockQty: Number(stock), unit: 'unit', isDefault: true } },
      },
      include: { category: true, variants: { where: { isDefault: true }, take: 1 } },
    });

    router.post('/:id/variants', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
      try {
        const { name, sku, barcode, price, wholesalePrice, purchasePrice, stock } = req.body || {};
        if (!String(name || '').trim() || !String(sku || '').trim() || Number(price) < 0 || Number(stock) < 0) {
          return res.status(400).json({ success: false, message: 'Nama kemasan, SKU, harga, dan stok wajib diisi.' });
        }
        const variant = await prisma.productVariant.create({
          data: {
            productId: req.params.id,
            name: String(name).trim(),
            sku: String(sku).trim(),
            barcode: barcode ? String(barcode).trim() : null,
            basePrice: Number(purchasePrice || price),
            sellPrice: Number(price),
            wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
            stockQty: Number(stock),
            unit: String(name).trim(),
            isDefault: false,
          },
        });

        router.patch('/:id/variants/:variantId', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
          try {
            const { name, sku, barcode, price, wholesalePrice, purchasePrice, stock } = req.body || {};
            const variant = await prisma.productVariant.update({
              where: { id: req.params.variantId },
              data: {
                name: String(name).trim(),
                sku: String(sku).trim(),
                barcode: barcode ? String(barcode).trim() : null,
                basePrice: Number(purchasePrice || price),
                sellPrice: Number(price),
                wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
                stockQty: Number(stock),
              },
            });
            return res.json({ success: true, variant });
          } catch (error) {
            return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'SKU atau barcode kemasan sudah digunakan.' : 'Kemasan gagal diperbarui.' });
          }
        });
        return res.status(201).json({ success: true, variant });
      } catch (error) {
        return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'SKU atau barcode kemasan sudah digunakan.' : 'Kemasan gagal ditambahkan.' });
      }
    });
    const product = await Promise.race([
      updatePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('PRODUCT_UPDATE_TIMEOUT')), 12000)),
    ]);
    if (changes.length) {
      await prisma.auditLog.createMany({
        data: changes.map(([field, oldValue, newValue]) => ({
          entityType: 'ProductVariant',
          entityId: variant.id,
          field,
          oldValue: oldValue == null ? null : String(oldValue),
          newValue: newValue == null ? null : String(newValue),
          changedById: req.user.id,
        })),
      });
    }
    return res.json({ success: true, product: formatProduct(product, AUDIENCE.OWNER) });  } catch (error) {
    console.error('Product update failed:', error.message);
    return res.status(error.message === 'PRODUCT_UPDATE_TIMEOUT' ? 504 : 400).json({ success: false, message: error.message === 'PRODUCT_UPDATE_TIMEOUT' ? 'Database terlalu lama merespons. Coba simpan lagi.' : error.code === 'P2002' ? 'SKU sudah digunakan' : 'Produk gagal diperbarui' });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true, variants: { select: { id: true } } } });
    if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    const variantIds = product.variants.map((variant) => variant.id);

    await prisma.$transaction(async (transaction) => {
      // Keep completed order history readable while releasing product identifiers.
      await transaction.orderItem.updateMany({ where: { OR: [{ productId: product.id }, { variantId: { in: variantIds } }] }, data: { productId: null, variantId: null } });
      await transaction.stockMovement.deleteMany({ where: { OR: [{ productId: product.id }, { variantId: { in: variantIds } }] } });
      await transaction.stockOpname.deleteMany({ where: { variantId: { in: variantIds } } });
      await transaction.eventPackageItem.deleteMany({ where: { variantId: { in: variantIds } } });
      await transaction.parcelItem.deleteMany({ where: { variantId: { in: variantIds } } });
      await transaction.productVariant.deleteMany({ where: { productId: product.id } });
      await transaction.product.delete({ where: { id: product.id } });
    });
    return res.json({ success: true, message: 'Produk dihapus permanen dari database' });
  } catch (error) {
    console.error('Permanent product delete failed:', error.message);
    return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: error.code === 'P2025' ? 'Produk tidak ditemukan' : 'Produk gagal dihapus permanen. Periksa data yang masih terkait.' });
  }
});

router.get('/:id', softAuth, catalog.getProduct);
export default router;