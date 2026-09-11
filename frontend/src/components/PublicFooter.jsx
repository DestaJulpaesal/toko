import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="brand">Glosir</Link>
          <p>Kebutuhan harian, parcel, dan paket acara dalam satu tempat.</p>
        </div>
        <div className="footer-links">
          <div><strong>Jelajahi</strong><Link to="/products">Produk</Link><Link to="/parsel">Parsel</Link><Link to="/promo">Promo</Link><Link to="/testimoni">Testimoni</Link></div>
          <div><strong>Bantuan</strong><Link to="/profil">Tentang Glosir</Link><Link to="/faq">Pusat Bantuan</Link><Link to="/contact-us">Contact Us</Link><Link to="/syarat-ketentuan">Syarat & Ketentuan</Link></div>
          <div><strong>Legal</strong><Link to="/kebijakan-privasi">Kebijakan Privasi</Link><Link to="/pusat-bantuan">FAQ</Link><Link to="/login">Login</Link></div>
        </div>
      </div>
      <div className="footer-bottom"><span>© 2026 Glosir. Semua hak dilindungi.</span><span>Order mudah, dilayani dengan dekat.</span></div>
    </footer>
  );
}
