import { ChevronLeft } from 'lucide-react';
import ProductCard from '../components/ProductCard';

const HOMEPAGE_SECTIONS = {
  'flash-sale': {
    eyebrow: 'Penawaran spesial',
    title: 'Flash Sale',
    description: 'Semua produk dengan harga promo aktif.',
  },
  recommended: {
    eyebrow: 'Pilihan untukmu',
    title: 'Rekomendasi untuk Anda',
    description: 'Produk pilihan yang direkomendasikan toko.',
  },
  bestsellers: {
    eyebrow: 'Favorit pelanggan',
    title: 'Produk Terlaris',
    description: 'Produk terlaris berdasarkan transaksi selesai atau pilihan toko.',
  },
};

export default function HomeProductSectionPage({
  section,
  products,
  loading,
  error,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onBack,
}) {
  const sectionConfig = HOMEPAGE_SECTIONS[section];

  return (
    <div className="home-section-products-shell">
      <button type="button" onClick={onBack} className="home-section-back-link">
        <ChevronLeft size={18} /> Kembali ke beranda
      </button>
      {!sectionConfig ? (
        <section className="home-section-products-state">
          <h1>Bagian produk tidak ditemukan</h1>
        </section>
      ) : (
        <>
          <header className="home-section-products-heading">
            <span>{sectionConfig.eyebrow}</span>
            <h1>{sectionConfig.title}</h1>
            <p>{sectionConfig.description}</p>
          </header>

          {loading ? (
            <p className="home-section-products-state" role="status">Memuat produk...</p>
          ) : error ? (
            <p className="home-section-products-state" role="alert">{error}</p>
          ) : products.length === 0 ? (
            <p className="home-section-products-state">Belum ada produk di bagian ini.</p>
          ) : (
            <div className="home-section-products-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isFavorited={isFavorite(product.id)}
                  onToggleFavorite={onToggleFavorite}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
