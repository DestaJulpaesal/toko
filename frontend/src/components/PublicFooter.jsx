import { Link } from 'react-router-dom';
<<<<<<< HEAD
import { MapPin, Clock, MessageCircle, Store } from 'lucide-react';
=======
<<<<<<< HEAD
import { MapPin, Clock, MessageCircle } from 'lucide-react';
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8

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
=======
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
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
      </div>
    </footer>
  );
}
