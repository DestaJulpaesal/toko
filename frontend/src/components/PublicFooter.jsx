import { Link } from 'react-router-dom';
import { Store, Phone, MapPin, Mail, ShieldCheck, Truck, Clock } from 'lucide-react';

export default function PublicFooter() {
  const storeWa = String(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const hasStoreWa = /^\d{8,15}$/.test(storeWa);
  const displayWa = storeWa.startsWith('62') ? `0${storeWa.slice(2)}` : storeWa;

  return (
    <footer className="public-footer">
      <div className="footer-top-highlights">
        <div className="footer-highlight-item">
          <Store className="w-6 h-6 text-emerald-600 mb-2" />
          <div>
            <strong>Grosir & Eceran</strong>
            <span>Pilihan lengkap harga hemat</span>
          </div>
        </div>
        <div className="footer-highlight-item">
          <Truck className="w-6 h-6 text-amber-500 mb-2" />
          <div>
            <strong>Pengiriman Cepat</strong>
            <span>Antar langsung ke lokasi</span>
          </div>
        </div>
        <div className="footer-highlight-item">
          <ShieldCheck className="w-6 h-6 text-emerald-600 mb-2" />
          <div>
            <strong>100% Produk Original</strong>
            <span>Kualitas terjamin & higienis</span>
          </div>
        </div>
        <div className="footer-highlight-item">
          <Clock className="w-6 h-6 text-amber-500 mb-2" />
          <div>
            <strong>Layanan Setiap Hari</strong>
            <span>Buka 08:00 - 21:00 WIB</span>
          </div>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="brand-footer-logo">
            <span className="brand-logo-icon">G</span>
            <span>GLOSIR</span>
          </Link>
          <p className="footer-desc">
            Pusat belanja kebutuhan harian, sembako, parsel hampers Lebaran/Hari Raya, dan paket acara terlengkap dengan harga grosir terbaik.
          </p>
          <div className="footer-contact-info">
            {hasStoreWa && (
              <span className="contact-item">
                <Phone className="w-4 h-4 text-emerald-500 inline mr-2" />
                <a href={`https://wa.me/${storeWa}`} target="_blank" rel="noreferrer" className="footer-whatsapp-link">
                  WA: {displayWa}
                </a>
              </span>
            )}
            <span className="contact-item"><MapPin className="w-4 h-4 text-emerald-500 inline mr-2" /> Toko Glosir Utama</span>
          </div>
        </div>

        <div className="footer-links">
          <div>
            <strong>Katalog Belanja</strong>
            <Link to="/products">Katalog Produk</Link>
            <Link to="/parsel">Parsel Lebaran</Link>
            <Link to="/promo">Promo Spesial</Link>
          </div>
          <div>
            <strong>Pusat Bantuan</strong>
            <Link to="/profil">Profil Glosir</Link>
            <Link to="/faq">Pertanyaan FAQ</Link>
            <Link to="/contact-us">Hubungi Kami</Link>
          </div>
          <div>
            <strong>Area Karyawan</strong>
            <Link to="/login">Login Portal</Link>
            <Link to="/kasir">Portal Kasir</Link>
            <Link to="/admin">Dashboard Owner</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Glosir Store. All Rights Reserved.</span>
        <span>Pusat Belanja Grosir & Parsel Terpercaya</span>
      </div>
    </footer>
  );
}
