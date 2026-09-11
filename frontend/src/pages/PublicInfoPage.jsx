import { useEffect, useMemo, useState } from 'react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

const pageMap = {
  terms: { type: 'TERMS', title: 'Syarat & Ketentuan', description: 'Ketentuan penggunaan layanan Glosir.' },
  privacy: { type: 'PRIVACY', title: 'Kebijakan Privasi', description: 'Cara kami menjaga perlindungan data pelanggan.' },
  contact: { type: 'CONTACT', title: 'Contact Us', description: 'Kirim pertanyaan, permintaan, atau kebutuhan Anda.' },
  faq: { type: 'FAQ', title: 'Pusat Bantuan / FAQ', description: 'Jawaban untuk pertanyaan paling umum pelanggan.' },
  help: { type: 'HELP', title: 'Pusat Bantuan', description: 'Dukungan pelanggan dan bantuan untuk kebutuhan Anda.' },
  testimonials: { type: 'TESTIMONIAL', title: 'Testimoni / Ulasan', description: 'Pengalaman pelanggan yang sudah menggunakan layanan Glosir.' },
};

function parseContentBlocks(content = '') {
  return content
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default function PublicInfoPage({ pageKey = 'terms' }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const meta = useMemo(() => pageMap[pageKey] || pageMap.terms, [pageKey]);

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      const cacheKey = `glosir_public_content_${meta.type.toLowerCase()}`;
      let hasCachedPage = false;
      try {
        const cachedPage = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cachedPage) {
          setPage(cachedPage);
          setLoading(false);
          hasCachedPage = true;
        }
      } catch {
        // Ignore an invalid local cache and use the API response.
      }

      if (!hasCachedPage) setLoading(true);
      setError('');
      try {
        const response = await apiFetch(`/site-content/public?type=${meta.type.toLowerCase()}`);
        const data = await response.json();
        if (!active) return;
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Konten gagal dimuat.');
        }

        const item = data.data?.item || data.data?.items?.[0] || null;
        setPage(item);
        if (item) localStorage.setItem(cacheKey, JSON.stringify(item));
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Konten gagal dimuat.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPage();
    return () => {
      active = false;
    };
  }, [meta.type]);

  const contentBlocks = page ? parseContentBlocks(page.content) : [];

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="public-content-shell">
        <section className="inner-hero info-hero">
          <div>
            <span className="eyebrow dark">Informasi Publik</span>
            <h1>{meta.title}</h1>
          </div>
          <p>{meta.description}</p>
        </section>

        <section className="info-card-wrap">
          {loading && <div className="info-card loading-state">Memuat data...</div>}
          {error && <div className="info-card error-state">{error}</div>}

          {!loading && !error && page && (
            <article className="info-card">
              <div className="info-card-head">
                <span className="pill">{page.type}</span>
                <h2>{page.title}</h2>
              </div>

              {contentBlocks.length > 0 ? (
                <div className="info-content-blocks">
                  {contentBlocks.map((block, index) => {
                    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
                    const isListBlock = lines.some((line) => line.startsWith('-') || line.startsWith('Q:') || line.startsWith('A:'));

                    return isListBlock ? (
                      <ul key={index} className="info-list">
                        {lines.map((line, lineIndex) => (
                          <li key={`${index}-${lineIndex}`}>
                            {line.replace(/^[-*]\s*/, '').replace(/^Q:\s*/, 'Q: ').replace(/^A:\s*/, 'A: ')}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p key={index}>{block}</p>
                    );
                  })}
                </div>
              ) : (
                <p>Konten belum tersedia untuk kategori ini.</p>
              )}
            </article>
          )}

          {!loading && !error && !page && (
            <div className="info-card empty-state">
              <h2>Konten belum dibuat</h2>
              <p>Silakan buat data ini dari panel admin agar informasi publik dapat ditampilkan di website.</p>
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
