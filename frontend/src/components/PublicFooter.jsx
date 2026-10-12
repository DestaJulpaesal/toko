import { Link } from 'react-router-dom';
import { MapPin, Clock, MessageCircle, Store } from 'lucide-react';

export default function PublicFooter() {
  const storeWaNumber = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '';

  return (
    <footer className="public-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="footer-brand-title">
            <span className="footer-brand-mark"><Store size={21} /></span>
            <span>Glosir</span>
          </Link>
          <span className="footer-brand-caption">Belanja dekat, harga bersahabat</span>
          <p className="footer-brand-description">Toko grosir & eceran sembako harian kampung. Pesan mudah dari HP, ambil dan bayar langsung di toko.</p>
          <div className="footer-store-info">
            <div className="footer-store-detail">
              <span className="footer-store-icon"><MapPin size={18} /></span>
              <span><small>Alamat toko</small><strong>Jl. Raya Kampung Glosir No. 1</strong></span>
            </div>
            <div className="footer-store-detail">
              <span className="footer-store-icon"><Clock size={18} /></span>
              <span><small>Jam operasional</small><strong>Setiap hari, 08:00–21:00 WIB</strong></span>
            </div>
            <p className="footer-wa-wrap">
              <a
                href={`https://wa.me/${storeWaNumber}`}
                target="_blank"
                rel="noreferrer"
                className="footer-wa-link"
              >
                <MessageCircle size={18} /> <span>Chat WhatsApp toko</span>
              </a>
            </p>
          </div>
        </div>
        <div className="footer-links">
          <div className="footer-link-group">
            <strong>Belanja</strong>
            <Link to="/products">Katalog Produk</Link>
            <Link to="/promo">Promo Minggu Ini</Link>
          </div>
          <div className="footer-link-group">
            <strong>Bantuan</strong>
            <Link to="/profil">Profil Toko</Link>
            <Link to="/faq">Pusat Bantuan</Link>
            <Link to="/contact-us">Kontak Kami</Link>
          </div>
          <div className="footer-link-group">
            <strong>Legal</strong>
            <Link to="/syarat-ketentuan">Syarat & Ketentuan</Link>
            <Link to="/kebijakan-privasi">Kebijakan Privasi</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Glosir. Toko Grosir & Eceran Keluarga.</span>
        <span>Pesan online, ambil di toko.</span>
      </div>
    </footer>
  );
}
