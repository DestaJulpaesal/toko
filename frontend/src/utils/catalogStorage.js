// Penyimpanan lokal (browser) untuk data katalog, dengan aturan keamanan:
// 1. Data publik (pengunjung) dan data admin TIDAK boleh berbagi tempat penyimpanan.
// 2. Data yang tersimpan di browser dibersihkan dari field harga modal / harga khusus,
//    sebagai lapis pengaman tambahan. Yang utama tetap server tidak mengirimnya.

export const PUBLIC_CATALOG_CACHE_KEY = 'glosir_public_catalog_v2';
export const ADMIN_PRODUCTS_CACHE_KEY = 'glosir_admin_products_v1'; // disimpan di sessionStorage, hilang saat tab ditutup
const LEGACY_CATALOG_CACHE_KEY = 'glosir_products_cache'; // dulu dipakai bersama oleh halaman publik dan admin

const SENSITIVE_KEYS = new Set(['purchasePrice', 'basePrice', 'wholesalePrice', 'costPrice']);

export function stripSensitive(value) {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEYS.has(key))
        .map(([key, entry]) => [key, stripSensitive(entry)])
    );
  }
  return value;
}

export function readJsonStorage(storage, key, fallback) {
  try {
    const saved = storage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

// Hapus cache lama yang mungkin masih berisi harga modal dari versi sebelumnya.
export function purgeLegacyCatalogCache() {
  try {
    localStorage.removeItem(LEGACY_CATALOG_CACHE_KEY);
  } catch {
    // Storage bisa saja diblokir browser; abaikan.
  }
}

// Panggil saat logout / sesi berakhir supaya data internal tidak tertinggal di perangkat.
export function clearStaffCaches() {
  purgeLegacyCatalogCache();
  try {
    sessionStorage.removeItem(ADMIN_PRODUCTS_CACHE_KEY);
  } catch {
    // Abaikan.
  }
}
