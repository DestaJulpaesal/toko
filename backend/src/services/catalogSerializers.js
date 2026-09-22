// Aturan "siapa boleh melihat data apa" untuk katalog (produk, paket acara, parsel).
//
// Prinsip utama: SERVER yang menentukan data apa yang keluar, bukan tampilan.
// Semua serializer memakai ALLOWLIST (daftar field yang BOLEH keluar). Kalau nanti
// ada kolom baru di database, kolom itu TIDAK ikut terkirim sampai kita sengaja menambahkannya.
// Audiens default = 'public' supaya kalau ada yang lupa mengisi, hasilnya tetap aman.

export const AUDIENCE = Object.freeze({
  PUBLIC: 'public', // pengunjung tanpa login (atau role lain yang tidak butuh data internal)
  STAFF: 'staff', // kasir: boleh SKU, barcode, harga grosir. TIDAK boleh harga modal
  OWNER: 'owner', // OWNER / ADMIN: semua field, termasuk harga modal
});

const OWNER_ROLES = ['OWNER', 'ADMIN'];
const STAFF_ROLES = ['CASHIER'];
const PARCEL_STAFF_ROLES = ['OWNER', 'ADMIN', 'PARCEL_MANAGER'];

export function getAudience(user) {
  const role = user?.role;
  if (OWNER_ROLES.includes(role)) return AUDIENCE.OWNER;
  if (STAFF_ROLES.includes(role)) return AUDIENCE.STAFF;
  return AUDIENCE.PUBLIC;
}

export const isOwnerAudience = (user) => getAudience(user) === AUDIENCE.OWNER;

// Parsel yang tidak aktif (draft) hanya boleh dilihat pengelola, bukan pengunjung.
export const parcelListWhere = (user) => (PARCEL_STAFF_ROLES.includes(user?.role) ? undefined : { isActive: true });

const statusFromDb = (status, stock, stockWarning) => (status === 'DRAFT' ? 'Draft' : stock <= stockWarning ? 'Stok menipis' : 'Aktif');

const toNumberOrNull = (value) => (value == null ? null : Number(value));

export function formatProduct(product, audience = AUDIENCE.PUBLIC) {
  const variant = product.variants?.[0];
  const stock = variant?.stockQty || 0;
  const price = Number(variant?.sellPrice || 0);
  // Harga coret HANYA dari nilai yang diisi owner. Dulu ada cadangan yang mengambil harga modal
  // ketika modal > harga jual, sehingga angka modal bisa tampil sebagai "harga coret" ke pelanggan.
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
  const discountPercent = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  const formatted = {
    id: product.id,
    variantId: variant?.id,
    name: product.name,
    category: product.category?.name || 'Glosir',
    price,
    originalPrice,
    discountPercent,
    imageUrl: product.imageUrl || null,
    stock,
    variants: (product.variants || []).map((item) => {
      const publicVariant = {
        id: item.id,
        name: item.name,
        price: Number(item.sellPrice || 0),
        stock: item.stockQty || 0,
        isDefault: Boolean(item.isDefault),
      };
      if (audience === AUDIENCE.PUBLIC) return publicVariant;
      const staffVariant = {
        ...publicVariant,
        sku: item.sku,
        barcode: item.barcode,
        wholesalePrice: toNumberOrNull(item.wholesalePrice),
      };
      if (audience === AUDIENCE.OWNER) return { ...staffVariant, purchasePrice: Number(item.basePrice || 0) };
      return staffVariant;
    }),
    status: statusFromDb(product.status, stock, product.stockWarning),
    badge: discountPercent > 0
      ? `Diskon ${discountPercent}%`
      : product.isFeatured
      ? 'Best Seller'
      : product.isParcel
      ? 'Parsel'
      : 'Tersedia',
  };

  if (audience === AUDIENCE.PUBLIC) return formatted;

  const staffProduct = {
    ...formatted,
    sku: product.sku,
    barcode: variant?.barcode || null,
    wholesalePrice: toNumberOrNull(variant?.wholesalePrice),
    isQuickAccess: Boolean(product.isQuickAccess),
  };
  if (audience === AUDIENCE.OWNER) return { ...staffProduct, purchasePrice: Number(variant?.basePrice || 0) };
  return staffProduct;
}

// Paket acara: untuk SEMUA audiens hanya membawa data yang dibutuhkan tampilan
// (nama, jumlah, harga jual). Tidak pernah membawa kolom varian/produk mentah dari database.
export function formatEventPackage(item) {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    price: Number(item.price),
    isManualPrice: Boolean(item.isManualPrice),
    isCustom: Boolean(item.isCustom),
    isActive: Boolean(item.isActive),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    items: (item.items || []).map((entry) => ({
      id: entry.id,
      eventPackageId: entry.eventPackageId,
      variantId: entry.variantId,
      quantity: entry.quantity,
      variant: entry.variant
        ? {
          id: entry.variant.id,
          productId: entry.variant.productId,
          name: entry.variant.name,
          sellPrice: Number(entry.variant.sellPrice),
          product: entry.variant.product ? { id: entry.variant.product.id, name: entry.variant.product.name } : undefined,
        }
        : undefined,
    })),
  };
}

// Daftar field yang tidak boleh muncul di respons publik. Dipakai oleh tes otomatis.
export const PUBLIC_FORBIDDEN_KEYS = Object.freeze(['purchasePrice', 'basePrice', 'wholesalePrice', 'costPrice', 'sku', 'barcode']);

// Menelusuri objek/array sampai ke dalam, mengembalikan lokasi key terlarang (kosong = aman).
export function findForbiddenKeys(value, keys = PUBLIC_FORBIDDEN_KEYS, path = '$') {
  if (Array.isArray(value)) return value.flatMap((entry, index) => findForbiddenKeys(entry, keys, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => [
      ...(keys.includes(key) ? [`${path}.${key}`] : []),
      ...findForbiddenKeys(entry, keys, `${path}.${key}`),
    ]);
  }
  return [];
}
