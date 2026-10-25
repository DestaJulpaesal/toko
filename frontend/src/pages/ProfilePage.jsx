import { useEffect, useState } from 'react';
import { Store, ShieldCheck, Sparkles } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

const values = [
  { number: '01', title: 'Harga yang jujur', text: 'Kami menjaga harga tetap masuk akal untuk kebutuhan rumah, usaha, dan acara keluarga.' },
  { number: '02', title: 'Pilihan yang relevan', text: 'Produk dipilih dari kebutuhan pelanggan sehari-hari, bukan sekadar memenuhi katalog.' },
  { number: '03', title: 'Dilayani dengan dekat', text: 'Setiap pesanan ditangani dengan komunikasi yang jelas dari awal sampai selesai.' },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: 'Owner Glosir',
    phone: '081234567890',
    headline: 'Usaha keluarga yang tumbuh dari kebutuhan sehari-hari.',
    story: 'Glosir hadir untuk membantu keluarga, pemilik usaha kecil, dan panitia acara mendapatkan kebutuhan penting dengan cara yang lebih praktis.',
    photoUrl: '',
  });

  useEffect(() => {
    apiFetch('/site-profile')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.profile) {
          throw new Error(data.message || 'Profil publik belum tersedia.');
        }
        setProfile((current) => ({ ...current, ...data.profile }));
      })
      .catch((error) => console.warn('Public profile unavailable; using frontend defaults:', error.message));
  }, []);

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="profile-page-shell">
        <section className="inner-hero profile-hero">
          <div>
            <span className="eyebrow dark">Tentang Glosir</span>
            <h1>{profile.headline}</h1>
          </div>
          <p>{profile.story}</p>
        </section>

        <section className="profile-story">
          <div className="profile-owner-card">
            <div className="profile-owner-badge-wrap">
              <span className="profile-owner-badge">
                <Store size={14} /> Pemilik &amp; Pengelola
              </span>
            </div>

            <div className="profile-owner-frame">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="profile-owner-photo"
                />
              ) : (
                <div className="profile-owner-placeholder">
                  <span className="profile-placeholder-icon">🏪</span>
                  <strong>{profile.name}</strong>
                </div>
              )}
            </div>

            <div className="profile-owner-info">
              <h3 className="profile-owner-name">{profile.name}</h3>
              <p className="profile-owner-store">Glosir Family Store</p>
              <div className="profile-owner-chips">
                <span className="profile-owner-chip">
                  <Sparkles size={12} /> Ramah &amp; Terpercaya
                </span>
                <span className="profile-owner-chip">
                  <ShieldCheck size={12} /> Amanah &amp; Dekat
                </span>
              </div>
            </div>
          </div>

          <div className="profile-story-copy">
            <span className="eyebrow dark">Cerita kami</span>
            <h2>Berawal dari melayani sekitar, lalu dipercaya lebih banyak orang.</h2>
            <p>Glosir dibangun dengan keyakinan sederhana: belanja kebutuhan pokok dan parcel seharusnya terasa mudah, jelas, dan manusiawi.</p>
            <p>Dari pemesanan harian hingga kebutuhan hajatan, kami membantu pelanggan memilih paket yang sesuai jumlah, budget, dan momen yang sedang disiapkan.</p>
            <a href={`https://wa.me/${profile.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn btn-primary">Bicara dengan kami</a>
          </div>
        </section>

        <section className="values-section">
          <div className="section-head">
            <div><span className="eyebrow">Cara kami bekerja</span><h2>Hal kecil yang kami jaga.</h2></div>
          </div>
          <div className="values-grid">
            {values.map((value) => (
              <article key={value.number} className="value-card">
                <span>{value.number}</span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
