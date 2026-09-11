import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites();
  const { addItem } = useCart();

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="favorites-shell">
        <div className="inner-hero favorites-hero"><div><span className="eyebrow dark">Koleksi kamu</span><h1>Produk favorit.</h1></div><p>Simpan produk yang ingin kamu ingat dan pesan kapan saja.</p></div>
        {favorites.length === 0 ? (
          <section className="favorites-empty"><div className="empty-symbol">☆</div><h2>Belum ada produk tersimpan</h2><p>Klik ikon bintang pada produk yang ingin kamu simpan.</p><Link to="/products" className="btn btn-primary">Jelajahi produk</Link></section>
        ) : (
          <section className="favorites-grid">{favorites.map((product) => <article className="catalog-card" key={product.id}><button className="favorite-button active" onClick={() => toggleFavorite(product)} aria-label="Hapus dari favorit">★</button><Link to={`/products/${product.id}`} className={`catalog-image product-art-link product-art-${product.id}`}><span className="product-art-label">{product.name.split(' ').slice(0, 2).join(' ')}</span><small>{product.category}</small></Link><span className="catalog-badge">{product.badge}</span><Link to={`/products/${product.id}`} className="catalog-title-link"><h3>{product.name}</h3></Link><div className="catalog-meta"><strong>Rp {product.price.toLocaleString('id-ID')}</strong><small>{product.stock} stok</small></div><button className="btn btn-primary full" onClick={() => addItem(product)}>Tambah ke keranjang</button></article>)}</section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
