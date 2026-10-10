import { Link } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import CatalogImage from './CatalogImage';

export default function ProductCard({ product, isFavorited = false, onToggleFavorite, onAddToCart }) {
  const hasDiscount = (product.originalPrice && product.originalPrice > product.price) || (product.discountPercent > 0);
  const discountPct = product.discountPercent || (product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0);

  return (
    <article
      className="bg-white border border-gray-200 rounded-[18px] p-3 flex flex-col relative shadow-sm hover:shadow-md transition-shadow"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '18px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Kontainer Foto Produk & Tombol Wishlist */}
      <div
        className="relative w-full aspect-square rounded-[14px] overflow-hidden bg-slate-50 mb-2.5 block"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: '14px',
          overflow: 'hidden',
          background: '#f8fafc',
          marginBottom: '10px',
        }}
      >
        {/* Tombol Wishlist / Favorit Interaktif */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onToggleFavorite) onToggleFavorite(product);
          }}
          aria-label={isFavorited ? `Hapus ${product.name} dari favorit` : `Tambahkan ${product.name} ke favorit`}
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center transition-all cursor-pointer border-none"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            transition: 'transform 0.15s ease, background 0.15s ease',
          }}
        >
          <Heart
            size={18}
            className={isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600 fill-none'}
            fill={isFavorited ? '#ef4444' : 'none'}
            color={isFavorited ? '#ef4444' : '#4b5563'}
            strokeWidth={2}
          />
        </button>

        {/* Link & Foto */}
        <Link
          to={product.detailPath || `/products/${product.id}`}
          className="w-full h-full block"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            textDecoration: 'none',
          }}
        >
          <CatalogImage src={product.imageUrl} alt={`Foto ${product.name}`}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontSize: '0.85rem',
                padding: '12px',
                textAlign: 'center',
                background: '#f1f5f9',
              }}
            >
              <span style={{ fontSize: '2rem', marginBottom: '4px', lineHeight: 1 }}>🛍️</span>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#64748b',
                  lineHeight: '1.2',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {product.name}
              </span>
            </div>
          </CatalogImage>
        </Link>
      </div>

      {/* Badge Diskon / Promo */}
      {hasDiscount && (
        <div style={{ marginBottom: '6px' }}>
          <span
            className="bg-red-100 text-red-600 text-xs font-extrabold px-2 py-0.5 rounded-md"
            style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}
          >
            Hemat {discountPct}%
          </span>
        </div>
      )}

      {/* Kategori & Satuan */}
      <small
        className="text-gray-500 text-[0.78rem] mb-0.5"
        style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '2px' }}
      >
        {product.category} {product.unit ? `• /${product.unit}` : ''}
      </small>

      {/* Nama Produk */}
      <Link
        to={product.detailPath || `/products/${product.id}`}
        className="text-gray-900 font-bold text-base leading-snug mb-2 line-clamp-2 min-h-[2.6em] no-underline hover:text-[#1f7a4a]"
        style={{
          textDecoration: 'none',
          color: '#111827',
          fontWeight: 700,
          fontSize: '1rem',
          lineHeight: '1.3',
          marginBottom: '8px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '2.6em',
        }}
      >
        {product.name}
      </Link>

      {/* Harga Produk */}
      <div style={{ marginTop: 'auto', marginBottom: '12px' }}>
        <div
          className="text-xl font-black text-[#1f7a4a]"
          style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1f7a4a' }}
        >
          Rp {Number(product.price).toLocaleString('id-ID')}
        </div>
        {product.originalPrice && product.originalPrice > product.price && (
          <del
            className="text-xs text-gray-400"
            style={{ fontSize: '0.82rem', color: '#9ca3af' }}
          >
            Rp {Number(product.originalPrice).toLocaleString('id-ID')}
          </del>
        )}
      </div>

      {/* Tombol Tambah Besar & Kontras */}
      <button
        type="button"
        onClick={() => onAddToCart && onAddToCart(product)}
        className="w-full min-h-[46px] rounded-xl bg-[#1f7a4a] hover:bg-[#166534] text-white font-extrabold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
        style={{
          width: '100%',
          minHeight: '46px',
          borderRadius: '12px',
          background: '#1f7a4a',
          color: '#ffffff',
          border: 'none',
          fontWeight: 800,
          fontSize: '0.95rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'background 0.15s',
        }}
      >
        <Plus size={18} />
        Tambah
      </button>
    </article>
  );
}
