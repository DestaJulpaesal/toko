import { Link } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import CatalogImage from './CatalogImage';

/**
 * Kartu produk katalog (dipakai di /products, detail produk "terkait", dan seksi beranda).
 * Semua ukuran diatur lewat kelas CSS di styles/product-cards.css (tidak ada inline style),
 * supaya bisa diubah per breakpoint dan semua kartu selalu seragam:
 *   gambar (rasio tetap) -> meta 1 baris -> nama 2 baris -> harga (slot harga coret tetap) -> tombol.
 */
export default function ProductCard({ product, isFavorited = false, onToggleFavorite, onAddToCart }) {
  const hasDiscount = (product.originalPrice && product.originalPrice > product.price) || (product.discountPercent > 0);
  const discountPct = product.discountPercent || (product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0);
  const detailPath = product.detailPath || `/products/${product.id}`;
  const metaText = [product.category, product.unit ? `/${product.unit}` : ''].filter(Boolean).join(' \u2022 ');

  return (
    <article className="catalog-product-card">
      {/* Foto produk: rasio tetap, tidak pernah menentukan tinggi kartu */}
      <div className="catalog-product-image">
        <Link
          to={detailPath}
          className="catalog-product-image-link"
          aria-label={`Lihat ${product.name}`}
          tabIndex={-1}
        >
          <CatalogImage src={product.imageUrl} alt={`Foto ${product.name}`}>
            <div className="catalog-product-placeholder" role="img" aria-label={`Foto ${product.name} belum tersedia`}>
              <span aria-hidden="true">{'\u{1F6CD}\uFE0F'}</span>
            </div>
          </CatalogImage>
        </Link>

        {hasDiscount && discountPct > 0 && (
          <span className="catalog-product-badge">Hemat {discountPct}%</span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onToggleFavorite) onToggleFavorite(product);
          }}
          aria-label={isFavorited ? `Hapus ${product.name} dari favorit` : `Tambahkan ${product.name} ke favorit`}
          aria-pressed={isFavorited}
          className={`catalog-product-fav${isFavorited ? ' is-active' : ''}`}
        >
          <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="catalog-product-body">
        <small className="catalog-product-meta" title={metaText}>{metaText || '\u00A0'}</small>

        <Link to={detailPath} className="catalog-product-title" title={product.name}>
          {product.name}
        </Link>

        {/* Slot harga selalu 2 baris (harga + harga coret) agar kartu diskon & non-diskon sejajar */}
        <div className="catalog-product-price">
          <strong className="catalog-product-price-now">Rp {Number(product.price).toLocaleString('id-ID')}</strong>
          {product.originalPrice && product.originalPrice > product.price ? (
            <del className="catalog-product-price-old">Rp {Number(product.originalPrice).toLocaleString('id-ID')}</del>
          ) : (
            <span className="catalog-product-price-old" aria-hidden="true">{'\u00A0'}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddToCart && onAddToCart(product)}
          className="catalog-product-add"
          aria-label={`Tambah ${product.name} ke keranjang`}
        >
          <Plus size={16} aria-hidden="true" />
          <span>Tambah</span>
        </button>
      </div>
    </article>
  );
}
