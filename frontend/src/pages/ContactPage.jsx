import { useState } from 'react';
import { Clock3, MapPin, MessageCircle, Send, Star } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

const STORE_NAME = 'Grosir Bu Wida';
const STORE_ADDRESS = '5CVH+6Q4, Citatah Nyalindung, Cirawamekar, Kec. Cipatat, Kabupaten Bandung Barat, Jawa Barat 40554, Indonesia';
const STORE_WHATSAPP = String(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
const MAP_QUERY = encodeURIComponent(`${STORE_NAME}, ${STORE_ADDRESS}`);
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`;
const MAP_EMBED_URL = `https://maps.google.com/maps?q=${MAP_QUERY}&output=embed`;

const EMPTY_FORM = {
  name: '',
  phone: '',
  message: '',
};

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (feedback) setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await apiFetch('/site-content/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Pesan belum bisa dikirim. Coba lagi sebentar.');
      }

      setForm(EMPTY_FORM);
      setFeedback({ type: 'success', text: data.message });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Terjadi kendala saat mengirim pesan.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="public-page contact-page-shell">
      <PublicHeader />
      <main className="contact-page">
        <section className="contact-hero">
          <div className="contact-hero-glow contact-hero-glow-one" />
          <div className="contact-hero-glow contact-hero-glow-two" />
          <div className="contact-hero-content">
            <span className="contact-hero-eyebrow">Kami siap membantu</span>
            <h1>Kontak Glosir</h1>
            <p>Ada yang ingin ditanyakan? Ceritakan kebutuhanmu, tim kami siap membantu.</p>
          </div>
        </section>

        <section className="contact-main-card" aria-label="Informasi kontak dan formulir pesan">
          <aside className="contact-info-panel">
            <span className="contact-section-eyebrow">Hubungi kami</span>
            <h2>Senang bisa ngobrol denganmu.</h2>
            <p className="contact-info-intro">
              Tanya stok, kebutuhan grosir, pesanan acara, atau hal lain seputar Glosir.
            </p>

            <div className="contact-detail-list">
              <div className="contact-detail">
                <span className="contact-detail-icon"><MapPin size={20} /></span>
                <span>
                  <strong>Lokasi toko</strong>
                  <span>{STORE_ADDRESS}</span>
                  <a href={MAPS_URL} target="_blank" rel="noreferrer">Buka petunjuk arah</a>
                </span>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-icon"><MessageCircle size={20} /></span>
                <span>
                  <strong>WhatsApp toko</strong>
                  <span>{STORE_WHATSAPP || 'Chat langsung dengan tim Glosir'}</span>
                  {STORE_WHATSAPP && (
                    <a href={`https://wa.me/${STORE_WHATSAPP}`} target="_blank" rel="noreferrer">Mulai chat</a>
                  )}
                </span>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-icon"><Clock3 size={20} /></span>
                <span>
                  <strong>Jam operasional</strong>
                  <span>Setiap hari, 08:00–21:00 WIB</span>
                  <small>Pesanan sebelum 20:00 disiapkan di hari yang sama.</small>
                </span>
              </div>
              <div className="contact-response-note">
                <MessageCircle size={17} />
                <span>Isi formulir dan tim kami akan menghubungimu lewat WhatsApp.</span>
              </div>
            </div>
          </aside>

          <div className="contact-form-panel">
            <div className="contact-form-heading">
              <span className="contact-section-eyebrow">Kirim pesan</span>
              <h2>Ada yang bisa kami bantu?</h2>
              <p>Tulis nama, nomor WhatsApp, dan pesanmu. Tim kami akan segera menghubungi.</p>
            </div>

            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form-grid">
                <label>
                  Nama <span aria-hidden="true">*</span>
                  <input name="name" value={form.name} onChange={handleChange} autoComplete="name" required minLength={2} maxLength={100} placeholder="Nama lengkap" />
                </label>
                <label>
                  Nomor WhatsApp <span aria-hidden="true">*</span>
                  <input name="phone" value={form.phone} onChange={handleChange} autoComplete="tel" required minLength={8} maxLength={30} placeholder="08xx xxxx xxxx" />
                </label>
                <label className="contact-message-field">
                  Pesan <span aria-hidden="true">*</span>
                  <textarea name="message" value={form.message} onChange={handleChange} required minLength={3} maxLength={2000} rows={5} placeholder="Tulis pesanmu di sini..." />
                </label>
              </div>

              {feedback && (
                <div className={`contact-form-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
                  {feedback.text}
                </div>
              )}

              <button className="contact-submit-button" type="submit" disabled={submitting}>
                {submitting ? 'Mengirim pesan...' : 'Kirim pesan'}
                <Send size={17} />
              </button>
              <p className="contact-privacy-note">Data kontak hanya digunakan untuk menanggapi pesan ini.</p>
            </form>
          </div>
        </section>

        <section className="contact-map-section" aria-label="Lokasi toko Glosir">
          <div className="contact-map-heading">
            <div>
              <span className="contact-section-eyebrow">Temukan toko</span>
              <h2>Mampir langsung ke {STORE_NAME}</h2>
              <p>{STORE_ADDRESS}</p>
            </div>
            <a className="contact-directions-button" href={MAPS_URL} target="_blank" rel="noreferrer">
              <MapPin size={17} /> Petunjuk arah
            </a>
          </div>
          <div className="contact-map-frame">
            <iframe
              title="Peta lokasi Toko Glosir"
              src={MAP_EMBED_URL}
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <a className="contact-map-rating" href={MAPS_URL} target="_blank" rel="noreferrer">
              <span className="contact-map-rating-stars" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill="currentColor" />)}
              </span>
              <span>
                <strong>Pernah belanja di Glosir?</strong>
                <small>Bantu pelanggan lain dengan memberi rating di Google Maps</small>
              </span>
              <span className="contact-map-rating-action">Beri rating</span>
            </a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
