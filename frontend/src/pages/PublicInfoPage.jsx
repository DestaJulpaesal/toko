import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { publicInfoOrDefault } from '../utils/publicContentDefaults';

const pageMap = {
  terms: { type: 'TERMS', title: 'Syarat & Ketentuan', description: 'Panduan pemesanan dan penggunaan layanan Glosir.' },
  privacy: { type: 'PRIVACY', title: 'Kebijakan Privasi', description: 'Penjelasan tentang penggunaan dan perlindungan data pelanggan.' },
  faq: { type: 'FAQ', title: 'Pusat Bantuan', description: 'Jawaban untuk pertanyaan yang sering ditanyakan pelanggan.' },
  help: { type: 'HELP', title: 'Pusat Bantuan', description: 'Cara menghubungi tim dan mendapatkan bantuan dari Glosir.' },
  testimonials: { type: 'TESTIMONIAL', title: 'Cerita Pelanggan', description: 'Pengalaman pelanggan bersama Glosir.' },
};

function parseContentBlocks(content = '') {
  return content
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseFaqBlock(block) {
  const match = block.match(/(?:^|\n)Q:\s*([\s\S]*?)(?:\nA:\s*([\s\S]*))?$/i);
  if (!match) return null;
  return { question: match[1].trim(), answer: (match[2] || '').trim() };
}

function ContentBody({ item, type }) {
  const blocks = parseContentBlocks(item.content);

  if (type === 'FAQ') {
    const questions = blocks.map(parseFaqBlock).filter(Boolean);
    if (questions.length) {
      return (
        <div className="public-faq-list">
          {questions.map(({ question, answer }, index) => (
            <details className="public-faq-item" key={`${item.id}-${index}`}>
              <summary>{question}</summary>
              {answer && <p>{answer}</p>}
            </details>
          ))}
        </div>
      );
    }
  }

  if (type === 'TESTIMONIAL') {
    const quotes = blocks.map((block) => {
      const match = block.match(/^["“]?([\s\S]*?)["”]?\s*[-–—]\s*(.+)$/);
      return match ? { quote: match[1].replace(/^["“]|["”]$/g, '').trim(), author: match[2].trim() } : null;
    }).filter(Boolean);

    if (quotes.length) {
      return (
        <div className="public-testimonial-grid">
          {quotes.map(({ quote, author }, index) => (
            <blockquote className="public-testimonial-card" key={`${item.id}-${index}`}>
              <Quote size={19} aria-hidden="true" />
              <p>{quote}</p>
              <cite>{author}</cite>
            </blockquote>
          ))}
        </div>
      );
    }
  }

  const isNumberedList = blocks.length > 1 && blocks.every((block) => /^\d+[.)]\s+/.test(block));
  const isBulletList = blocks.every((block) => block.split('\n').every((line) => /^[-*]\s+/.test(line.trim())));

  if (isNumberedList) {
    return (
      <ol className="public-content-list public-content-list-numbered">
        {blocks.map((block, index) => <li key={`${item.id}-${index}`}>{block.replace(/^\d+[.)]\s+/, '')}</li>)}
      </ol>
    );
  }

  if (isBulletList) {
    return (
      <ul className="public-content-list">
        {blocks.flatMap((block) => block.split('\n').map((line) => line.trim().replace(/^[-*]\s+/, ''))).map((line, index) => (
          <li key={`${item.id}-${index}`}>{line}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="public-content-copy">
      {blocks.map((block, index) => <p key={`${item.id}-${index}`}>{block}</p>)}
    </div>
  );
}

export default function PublicInfoPage({ pageKey = 'terms' }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const meta = useMemo(() => pageMap[pageKey] || pageMap.terms, [pageKey]);

  useEffect(() => {
    let active = true;
    const cacheKey = `glosir_public_content_v2_${meta.type.toLowerCase()}`;

    const loadPage = async () => {
      try {
        const cachedItems = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (Array.isArray(cachedItems)) {
          setItems(cachedItems);
          setLoading(false);
        }
      } catch {
        try {
          localStorage.removeItem(cacheKey);
        } catch {
          // Browser storage may be disabled; fetch the published content anyway.
        }
      }

      setError('');
      try {
        const response = await apiFetch(`/site-content/public?type=${meta.type.toLowerCase()}`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Konten gagal dimuat.');
        if (!active) return;

        const publishedItems = Array.isArray(data.data?.items)
          ? data.data.items
          : data.data?.item
            ? [data.data.item]
            : [];
        const visibleItems = publicInfoOrDefault(meta.type, publishedItems);
        setItems(visibleItems);
        try {
          if (publishedItems.length) localStorage.setItem(cacheKey, JSON.stringify(publishedItems));
        } catch {
          // The page remains usable when browser storage is full or disabled.
        }
      } catch (loadError) {
        if (!active) return;
        console.warn('Public information unavailable; using frontend defaults:', loadError.message);
        setItems((current) => publicInfoOrDefault(meta.type, current));
      } finally {
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    loadPage();
    return () => {
      active = false;
    };
  }, [meta.type]);

  return (
    <div className="public-page public-info-page">
      <PublicHeader />
      <main className="public-content-shell">
        <section className="inner-hero info-hero">
          <div>
            <span className="eyebrow dark">INFORMASI GLOSIR</span>
            <h1>{meta.title}</h1>
          </div>
          <p>{meta.description}</p>
        </section>

        <section className="info-card-wrap" aria-live="polite">
          {loading && <div className="info-card loading-state">Memuat informasi...</div>}
          {error && <div className="info-card error-state" role="alert">{error}</div>}

          {!loading && !error && items.length > 0 && (
            <div className="public-info-list">
              {items.map((item, index) => (
                <article className={`info-card public-info-card public-info-card-${meta.type.toLowerCase()}`} key={item.id}>
                  <div className="info-card-head">
                    <span className="public-info-index">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <span className="public-info-type">{meta.title}</span>
                      <h2>{item.title}</h2>
                    </div>
                  </div>
                  <ContentBody item={item} type={meta.type} />
                </article>
              ))}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="info-card empty-state">
              <h2>Informasi belum tersedia</h2>
              <p>Tim Glosir sedang menyiapkan informasi untuk halaman ini.</p>
              <Link className="public-info-contact-link" to="/contact-us">Hubungi Glosir <ArrowRight size={16} /></Link>
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
