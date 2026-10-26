import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import CatalogImage from './CatalogImage';

/**
 * Kartu produk ringan (tanpa tombol favorit) untuk Beranda (flash sale & rekomendasi) dan /promo.
 * Memakai kelas yang sama dengan ProductCard (.catalog-product-*) sehingga ukuran/rasio/slot seragam
 * dan diatur dari satu tempat: styles/product-cards.css.
 */
export default function ProductTile({ product, badge, badgeTone = '', meta, onAdd, className = '' }) {
  const detailPath = product.detailPath || `/products/${product.id}`;
  const metaText = meta ?? [product.category, product.unit ? `/${product.unit}` : ''].filter(Boolean).join(' \u2022 ');
  const hasOld = Number(product.originalPrice) > Number(product.price);

  return (
    <article className={`catalog-product-card ${className}`.trim()}>
      <div className="catalog-product-image">
        <Link to={detailPath} className="catalog-product-image-link" aria-label={`Lihat ${product.name}`} tabIndex={-1}>
          <CatalogImage src={product.imageUrl} alt={`Foto ${product.name}`}>
            <div className="catalog-product-placeholder" role="img" aria-label={`Foto ${product.name} belum tersedia`}>
              <span aria-hidden="true">{'\u{1F6CD}\uFE0F'}</span>
            </div>
          </CatalogImage>
        </Link>
        {badge ? <span className={`catalog-product-badge ${badgeTone}`.trim()}>{badge}</span> : null}
      </div>

      <div className="catalog-product-body">
        <small className="catalog-product-meta" title={metaText}>{metaText || '\u00A0'}</small>

        <Link to={detailPath} className="catalog-product-title" title={product.name}>
          {product.name}
        </Link>

        <div className="catalog-product-price">
          <strong className="catalog-product-price-now">Rp {Number(product.price).toLocaleString('id-ID')}</strong>
          {hasOld ? (
            <del className="catalog-product-price-old">Rp {Number(product.originalPrice).toLocaleString('id-ID')}</del>
          ) : (
            <span className="catalog-product-price-old" aria-hidden="true">{'\u00A0'}</span>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => onAdd && onAdd(product, event)}
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
