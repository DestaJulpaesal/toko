export const DEFAULT_PUBLIC_CATEGORIES = [
  'Glosir',
  'Kebutuhan Dapur',
  'Minuman',
  'Bahan Pokok',
  'Acara',
  'Parsel',
].map((name) => ({ id: `default-${name}`, name, productCount: 0 }));

const PUBLIC_CATEGORY_ORDER = ['Glosir', 'Kebutuhan Dapur', 'Minuman', 'Bahan Pokok', 'Acara', 'Parsel'];

export const DEFAULT_PUBLIC_INFO = {
  TERMS: {
    title: 'Syarat & Ketentuan',
    content: `1. Pastikan data pemesanan sudah benar sebelum pesanan dikonfirmasi.

2. Produk diproses berdasarkan stok yang tersedia saat pesanan dibuat.

3. Jadwal, wilayah, dan biaya pengiriman dikonfirmasi sebelum pesanan diproses.`,
  },
  PRIVACY: {
    title: 'Kebijakan Privasi',
    content: 'Informasi yang diberikan saat memesan digunakan untuk memproses pesanan dan membantu layanan pelanggan. Hubungi Glosir melalui halaman kontak untuk permintaan terkait informasi Anda.',
  },
  FAQ: {
    title: 'Pusat Bantuan / FAQ',
    content: `Q: Apakah bisa pesan dengan jumlah banyak?
A: Ya, tanyakan kebutuhan dan jumlah pesanan kepada tim Glosir.

Q: Bagaimana cara memastikan stok?
A: Hubungi tim Glosir sebelum menyelesaikan pesanan.

Q: Apakah tersedia paket custom?
A: Tanyakan pilihan paket parsel atau acara melalui halaman kontak.`,
  },
  HELP: {
    title: 'Pusat Bantuan',
    content: `Jika membutuhkan bantuan, hubungi tim Glosir melalui halaman kontak.

- Cek status pesanan
- Tanya stok produk
- Konsultasi paket sesuai kebutuhan`,
  },
  TESTIMONIAL: {
    title: 'Testimoni / Ulasan',
    content: 'Belum ada testimoni pelanggan yang dipublikasikan.',
  },
};

export function publicCategoriesOrDefault(categories) {
  return categories.length ? categories : DEFAULT_PUBLIC_CATEGORIES;
}

export function sortPublicCategories(categories) {
  return [...categories].sort((first, second) => {
    const firstOrder = PUBLIC_CATEGORY_ORDER.indexOf(first.name);
    const secondOrder = PUBLIC_CATEGORY_ORDER.indexOf(second.name);
    if (firstOrder >= 0 || secondOrder >= 0) {
      if (firstOrder < 0) return 1;
      if (secondOrder < 0) return -1;
      return firstOrder - secondOrder;
    }
    return first.name.localeCompare(second.name, 'id');
  });
}

export function publicInfoOrDefault(type, items) {
  if (items.length) return items;
  const fallback = DEFAULT_PUBLIC_INFO[type];
  return fallback ? [{ id: `default-${type.toLowerCase()}`, type, ...fallback }] : [];
}
