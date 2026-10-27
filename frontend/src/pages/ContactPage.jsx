import { useEffect, useState } from 'react';
import { Clock3, Mail, MapPin, MessageCircle, Send, Star } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';
import { validateContactMessage } from '../utils/contactMessageValidation';

const EMPTY_FORM = {
  name: '',
  phone: '',
  message: '',
};

function parseContactContent(content = '') {
  const details = {};
  const contentLines = [];
  const labels = {
    alamat: 'address',
    lokasi: 'address',
    whatsapp: 'whatsapp',
    telepon: 'whatsapp',
    email: 'email',
    'jam operasional': 'hours',
    operasional: 'hours',
  };

  content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    const field = match ? labels[match[1].trim().toLowerCase()] : null;
    if (field) details[field] = match[2].trim();
    else contentLines.push(line);
  });

  return { details, contentLines };
}

function isPlaceholderContactValue(value = '') {
  return /\b(?:kota anda|area sekitar(?: toko)?|contoh|placeholder|belum diisi|your (?:city|address))\b/i.test(value);
}

export default function ContactPage() {
  const { storeProfile } = usePublicSettings();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [contactContents, setContactContents] = useState([]);
  const [contactError, setContactError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/site-content/public?type=contact')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Informasi kontak gagal dimuat.');
        if (active) setContactContents(Array.isArray(data.data?.items) ? data.data.items : []);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Public contact content failed to load:', error);
        setContactError(error.message || 'Informasi kontak gagal dimuat.');
      });
    return () => {
      active = false;
    };
  }, []);

  const primaryContact = contactContents[0] || null;
  const { details: contactDetails, contentLines: contactCopy } = parseContactContent(primaryContact?.content);
  const cmsAddress = contactDetails.address || '';
  const storeName = storeProfile.name || 'Toko Glosir';
  const configuredAddress = storeProfile.address || '';
  const storeAddress = cmsAddress && !isPlaceholderContactValue(cmsAddress)
    ? cmsAddress
    : configuredAddress || 'Informasi alamat toko belum tersedia.';
  const cmsWhatsapp = normalizeIndonesianPhone(contactDetails.whatsapp);
  const storeWhatsapp = normalizeIndonesianPhone(storeProfile.phone || import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '');
  const contactWhatsapp = cmsWhatsapp && cmsWhatsapp !== '081234567890' ? cmsWhatsapp : storeWhatsapp;
  const cmsHours = contactDetails.hours || '';
  const isLegacyHoursPlaceholder = /senin\s*-\s*sabtu.*08[.:]00\s*-\s*18[.:]00/i.test(cmsHours);
  const storeHours = cmsHours && !isPlaceholderContactValue(cmsHours) && !isLegacyHoursPlaceholder
    ? cmsHours
    : storeProfile.openingHours || 'Informasi jam buka belum tersedia.';
  const cmsEmail = contactDetails.email || '';
  const storeEmail = cmsEmail && !isPlaceholderContactValue(cmsEmail) && cmsEmail.toLowerCase() !== 'hello@glosir.id'
    ? cmsEmail
    : '';
  const mapQuery = encodeURIComponent(`${storeName}, ${storeAddress}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;

  const handleChange = (event) => {
    const { name, value } = event.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: validateContactMessage(updatedForm)[name] }));
    if (feedback) setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const errors = validateContactMessage(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFeedback({ type: 'error', text: 'Periksa kembali isian yang ditandai.' });
      formElement.elements.namedItem(Object.keys(errors)[0])?.focus();
      return;
    }

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
        if (Array.isArray(data.errors) && data.errors.length) {
          const serverErrors = data.errors.reduce((result, issue) => {
            if (['name', 'phone', 'message'].includes(issue.field)) result[issue.field] = issue.message;
            return result;
          }, {});
          if (Object.keys(serverErrors).length) {
            setFieldErrors(serverErrors);
            formElement.elements.namedItem(Object.keys(serverErrors)[0])?.focus();
            setFeedback({ type: 'error', text: 'Periksa kembali isian yang ditandai.' });
            return;
          }
        }
        throw new Error(data.message || 'Pesan belum bisa dikirim. Coba lagi sebentar.');
      }

      setForm(EMPTY_FORM);
      setFieldErrors({});
      setFeedback({ type: 'success', text: data.message });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof TypeError
          ? 'Koneksi sedang bermasalah. Periksa jaringan internet lalu coba lagi.'
          : error.message || 'Pesan belum dapat dikirim. Silakan coba lagi.',
      });
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
            <span className="contact-section-eyebrow">{primaryContact?.title || 'Hubungi kami'}</span>
            <h2>Senang bisa ngobrol denganmu.</h2>
            <p className="contact-info-intro">
              {contactCopy[0] || 'Tanya stok, kebutuhan grosir, pesanan acara, atau hal lain seputar Glosir.'}
            </p>
            {contactError && <p className="contact-content-error" role="status">{contactError}</p>}

            <div className="contact-detail-list">
              <div className="contact-detail">
                <span className="contact-detail-icon"><MapPin size={20} /></span>
                <span>
                  <strong>Lokasi toko</strong>
                  <span>{storeAddress}</span>
                  <a href={mapsUrl} target="_blank" rel="noreferrer">Buka petunjuk arah</a>
                </span>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-icon"><MessageCircle size={20} /></span>
                <span>
                  <strong>WhatsApp toko</strong>
                  <span>{contactWhatsapp || 'Chat langsung dengan tim Glosir'}</span>
                  {contactWhatsapp && (
                    <a href={`https://wa.me/${contactWhatsapp}`} target="_blank" rel="noreferrer">Mulai chat</a>
                  )}
                </span>
              </div>
              {storeEmail && (
                <div className="contact-detail">
                  <span className="contact-detail-icon"><Mail size={20} /></span>
                  <span><strong>Email toko</strong><span>{storeEmail}</span><a href={`mailto:${storeEmail}`}>Kirim email</a></span>
                </div>
              )}
              <div className="contact-detail">
                <span className="contact-detail-icon"><Clock3 size={20} /></span>
                <span>
                  <strong>Jam operasional</strong>
                  <span>{storeHours}</span>
                  <small>Pesanan sebelum 20:00 disiapkan di hari yang sama.</small>
                </span>
              </div>
              <div className="contact-response-note">
                <MessageCircle size={17} />
                <span>Isi nomor WhatsApp jika ingin dihubungi kembali lewat WhatsApp.</span>
              </div>
            </div>
            {contactCopy.length > 1 && (
              <div className="contact-cms-extra">
                {contactCopy.slice(1).map((line, index) => <p key={index}>{line}</p>)}
              </div>
            )}
          </aside>

          <div className="contact-form-panel">
            <div className="contact-form-heading">
              <span className="contact-section-eyebrow">Kirim pesan</span>
              <h2>Ada yang bisa kami bantu?</h2>
              <p>Tulis nama dan pesanmu. Nomor WhatsApp boleh dikosongkan.</p>
            </div>

            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <div className="contact-form-grid">
                <label>
                  Nama <span aria-hidden="true">*</span>
                  <input id="contact-name" name="name" value={form.name} onChange={handleChange} autoComplete="name" maxLength={100} placeholder="Nama lengkap" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined} />
                  {fieldErrors.name && <small className="contact-field-error" id="contact-name-error" role="alert">{fieldErrors.name}</small>}
                </label>
                <label>
                  Nomor WhatsApp <span className="contact-optional-label">(opsional)</span>
                  <input id="contact-phone" name="phone" value={form.phone} onChange={handleChange} autoComplete="tel" inputMode="tel" maxLength={30} placeholder="08xx xxxx xxxx" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'contact-phone-error' : undefined} />
                  {fieldErrors.phone && <small className="contact-field-error" id="contact-phone-error" role="alert">{fieldErrors.phone}</small>}
                </label>
                <label className="contact-message-field">
                  Pesan <span aria-hidden="true">*</span>
                  <textarea id="contact-message" name="message" value={form.message} onChange={handleChange} maxLength={2000} rows={5} placeholder="Tulis pesanmu di sini..." aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined} />
                  <small className="contact-message-counter">{form.message.length}/2.000 karakter</small>
                  {fieldErrors.message && <small className="contact-field-error" id="contact-message-error" role="alert">{fieldErrors.message}</small>}
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

        {contactContents.slice(1).length > 0 && (
          <section className="contact-cms-list" aria-label="Informasi kontak lainnya">
            {contactContents.slice(1).map((item) => (
              <article className="contact-cms-card" key={item.id}>
                <span className="contact-section-eyebrow">{item.type}</span>
                <h2>{item.title}</h2>
                {item.content.split(/\n\s*\n/).filter(Boolean).map((block, index) => <p key={index}>{block}</p>)}
              </article>
            ))}
          </section>
        )}

        <section className="contact-map-section" aria-label="Lokasi toko Glosir">
          <div className="contact-map-heading">
            <div>
              <span className="contact-section-eyebrow">Temukan toko</span>
              <h2>Mampir langsung ke {storeName}</h2>
              <p>{storeAddress}</p>
            </div>
            <a className="contact-directions-button" href={mapsUrl} target="_blank" rel="noreferrer">
              <MapPin size={17} /> Petunjuk arah
            </a>
          </div>
          <div className={`contact-map-frame${mapLoaded ? ' is-loaded' : ''}`}>
            <div className="contact-map-placeholder">
              <span className="contact-map-placeholder-pin"><MapPin size={24} /></span>
              <strong>{storeName}</strong>
              <span>{storeAddress}</span>
              <a href={mapsUrl} target="_blank" rel="noreferrer">Buka lokasi di Google Maps</a>
            </div>
            <iframe
              title="Peta lokasi Toko Glosir"
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              onLoad={() => setMapLoaded(true)}
            />
            <a className="contact-map-rating" href={mapsUrl} target="_blank" rel="noreferrer">
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
