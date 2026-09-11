import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

const products = [
  { id: '1', name: 'Kopi Bubuk Premium', category: 'Glosir', price: 48000, originalPrice: 60000, discountPercent: 20, stock: 25, badge: 'Diskon 20%', description: 'Kopi bubuk pilihan dengan rasa kuat dan aroma yang cocok untuk menemani aktivitas harian.' },
  { id: '2', name: 'Beras 5 Kg', category: 'Bahan Pokok', price: 72000, originalPrice: 75000, discountPercent: 4, stock: 18, badge: 'Hemat', description: 'Beras pilihan untuk kebutuhan rumah tangga dengan kemasan praktis dan stok aman.' },
  { id: '3', name: 'Minyak Goreng 2L', category: 'Kebutuhan Dapur', price: 35000, originalPrice: 40000, discountPercent: 12, stock: 9, badge: 'Diskon 12%', description: 'Minyak goreng untuk kebutuhan dapur harian, cocok untuk stok rumah dan usaha kecil.' },
  { id: '4', name: 'Parcel Lebaran', category: 'Parsel', price: 120000, originalPrice: 150000, discountPercent: 20, stock: 12, badge: 'Promo Spesial', description: 'Parcel hangat untuk berbagi dengan keluarga, kerabat, dan orang-orang terdekat.' },
  { id: '5', name: 'Paket Hajatan 20 Porsi', category: 'Acara', price: 580000, originalPrice: 650000, discountPercent: 11, stock: 4, badge: 'Paket Hemat', description: 'Paket kebutuhan acara yang bisa disesuaikan dengan jumlah tamu dan budget.' },
  { id: '6', name: 'Teh Celup 40 pcs', category: 'Minuman', price: 59000, originalPrice: 69000, discountPercent: 14, stock: 20, badge: 'Diskon 14%', description: 'Teh celup praktis dengan rasa ringan untuk disajikan di rumah maupun acara.' },
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const product = products.find((item) => item.id === id);

  if (!product) {
    return <div className="public-page"><PublicHeader /><main className="detail-empty"><h1>Produk tidak ditemukan</h1><Link to="/products" className="btn btn-primary">Kembali ke produk</Link></main><PublicFooter /></div>;
  }

  const addToCart = () => {
    for (let index = 0; index < quantity; index += 1) addItem(product);
  };

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="detail-shell">
        <Link to="/products" className="back-link">Kembali ke katalog</Link>
        <section className="detail-layout">
          <div className={`detail-art product-art-${product.id}`}><span>{product.name.split(' ').slice(0, 2).join(' ')}</span><small>{product.category}</small></div>
          <div className="detail-copy">
            <div className="catalog-badges-wrap">
              <span className="catalog-badge">{product.badge}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="discount-tag">
                  -{product.discountPercent || Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                </span>
              )}
            </div>
            <p className="eyebrow dark detail-category">{product.category}</p>
            <h1>{product.name}</h1>
            <div className="detail-price-box">
              <strong className="detail-price">Rp {product.price.toLocaleString('id-ID')}</strong>
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="detail-discount-row">
                  <del className="original-price">Rp {product.originalPrice.toLocaleString('id-ID')}</del>
                  <span className="save-pill">Hemat Rp {(product.originalPrice - product.price).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
            <p className="detail-description">{product.description}</p>
            <div className="detail-stock"><span className="stock-dot" /> {product.stock} stok tersedia</div>
            <div className="detail-actions"><div className="quantity-stepper"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button><strong>{quantity}</strong><button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}>+</button></div><button className="btn btn-primary" onClick={addToCart}>Tambah ke keranjang</button></div>
            <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="detail-whatsapp">Tanya produk lewat WhatsApp</a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
