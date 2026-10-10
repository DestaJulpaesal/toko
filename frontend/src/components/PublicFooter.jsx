import { Link } from 'react-router-dom';
import { MapPin, Clock, MessageCircle } from 'lucide-react';

export default function PublicFooter() {
  const storeWaNumber = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '';

  return (
    <footer className="public-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="brand-title" style={{ fontSize: '1.8rem', color: '#1f7a4a', fontWeight: 900 }}>Glosir</Link>
          <p>Toko grosir & eceran sembako harian kampung. Pesan mudah dari HP, ambil dan bayar di toko.</p>
          <div className="footer-store-info">
            <p><MapPin size={16} className="icon-inline" /> Alamat: Jl. Raya Kampung Glosir No. 1</p>
            <p><Clock size={16} className="icon-inline" /> Jam Buka: 08:00 - 21:00 WIB (Setiap Hari)</p>
            <p>
              <a
                href={`https://wa.me/${storeWaNumber}`}
                target="_blank"
                rel="noreferrer"
                className="footer-wa-link"
              >
                <MessageCircle size={16} className="icon-inline" /> WhatsApp: Hubungi Toko
              </a>
            </p>
          </div>
        </div>
        <div className="footer-links">
          <div>
            <strong>Belanja</strong>
            <Link to="/products">Katalog Produk</Link>
            <Link to="/promo">Promo Minggu Ini</Link>
          </div>
          <div>
            <strong>Bantuan</strong>
            <Link to="/profil">Profil Toko</Link>
            <Link to="/faq">Pusat Bantuan</Link>
            <Link to="/contact-us">Kontak Kami</Link>
          </div>
          <div>
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
