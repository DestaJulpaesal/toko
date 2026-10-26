import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, MessageCircle, PackageSearch, Send, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { API_BASE_URL } from '../services/api';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';

const INTERNAL_PATHS = ['/admin', '/kasir', '/parcel-manager', '/notifikasi', '/pelanggan'];
const HIDDEN_PUBLIC_PATHS = ['/login', '/verify-email', '/reset-password'];

function isWidgetAvailable(pathname) {
  return !INTERNAL_PATHS.some((path) => pathname.startsWith(path))
    && !HIDDEN_PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function formatMoney(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function createPageContext(pathname, items) {
  const productMatch = pathname.match(/^\/products\/([^/]+)$/);
  return {
    path: pathname,
    title: document.title.slice(0, 180),
    productId: productMatch ? decodeURIComponent(productMatch[1]).slice(0, 100) : null,
    cart: items.slice(0, 8).map((item) => ({
      name: String(item.name || '').slice(0, 160),
      quantity: Math.min(100, Math.max(1, Number(item.qty || 1))),
    })),
  };
}

function getWelcomeContent(pathname, totalItems) {
  if (pathname.startsWith('/products/')) {
    return {
      title: 'Lagi cari info produk?',
      description: 'Tanya stok atau harga produk yang sedang Kakak lihat.',
      suggestions: [
        { label: 'Cek stok', question: 'Apakah produk yang sedang saya lihat tersedia?' },
        { label: 'Tanya harga', question: 'Berapa harga produk yang sedang saya lihat?' },
      ],
    };
  }
  if (pathname === '/cart') {
    return totalItems
      ? {
        title: 'Keranjang siap diperiksa',
        description: `Ada ${totalItems} barang di keranjang. Tinjau jumlahnya, lalu lanjut checkout jika sudah sesuai.`,
        suggestions: [{ label: 'Cara pesan', action: 'guide' }],
      }
      : {
        title: 'Keranjang masih kosong',
        description: 'Cari barang yang dibutuhkan, lalu tambahkan ke keranjang untuk mulai memesan.',
        suggestions: [{ label: 'Cari produk', to: '/products' }],
      };
  }
  if (pathname === '/checkout') {
    return {
      title: 'Bantu selesaikan pesanan',
      description: 'Isi nama dan nomor WhatsApp aktif pada form checkout. Setelah pesanan dicatat, lanjutkan konfirmasi melalui WhatsApp toko.',
      suggestions: [
        { label: 'Kembali ke keranjang', to: '/cart' },
        { label: 'Cara pesan', action: 'guide' },
      ],
    };
  }
  if (pathname === '/pesanan') {
    return {
      title: 'Mau cek status pesanan?',
      description: 'Gunakan form di halaman ini dengan nomor pesanan dan 4 digit terakhir nomor WhatsApp saat memesan. Jangan kirim data itu di chat.',
      suggestions: [{ label: 'Buka cek pesanan', to: '/pesanan' }],
    };
  }
  if (pathname === '/products') {
    return {
      title: 'Mau cari kebutuhan apa?',
      description: 'Pilih kategori untuk melihat barang yang tersedia di katalog.',
      suggestions: [
        { label: 'Beras', to: '/products?search=beras' },
        { label: 'Minyak', to: '/products?search=minyak' },
        { label: 'Lihat promo', to: '/promo' },
      ],
    };
  }
  if (pathname === '/promo') {
    return {
      title: 'Sedang lihat promo',
      description: 'Tanya Globot tentang produk atau promo yang sedang Kakak lihat.',
      suggestions: [{ label: 'Cari produk', to: '/products' }],
    };
  }
  return {
    title: 'Halo, Kak! Ada yang dicari?',
    description: 'Aku bisa bantu cari produk, jelaskan cara pesan, atau arahkan Kakak ke status pesanan.',
    suggestions: [
      { label: 'Cari beras', to: '/products?search=beras' },
      { label: 'Cari minyak', to: '/products?search=minyak' },
      { label: 'Cek promo', to: '/promo' },
    ],
  };
}

export default function GlobotWidget() {
  const location = useLocation();
  const { items, totalItems, totalPrice } = useCart();
  const { storeProfile } = usePublicSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const conversationEndRef = useRef(null);
  const inputRef = useRef(null);
  const available = isWidgetAvailable(location.pathname);

  const supportNumber = normalizeIndonesianPhone(
    storeProfile.phone || import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER || import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '',
  );
  const supportUrl = supportNumber
    ? `https://wa.me/${supportNumber}?text=${encodeURIComponent('Halo, saya perlu bantuan berbelanja di Glosir.')}`
    : '/contact-us';
  const fallbackActions = [
    { label: 'Cari produk', to: '/products' },
    { label: 'Cek pesanan', to: '/pesanan' },
    ...(totalItems > 0 ? [{ label: 'Buka keranjang', to: '/cart' }] : []),
  ];

  useEffect(() => {
    if (!available) setIsOpen(false);
  }, [available]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!available) return null;

  const sendMessage = async (event, messageText = input) => {
    event?.preventDefault();
    const content = messageText.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/globot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(-12).map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
          context: createPageContext(location.pathname, items),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        if (response.status === 404) {
          setMessages((current) => [...current, {
            role: 'assistant',
            content: 'Maaf kak, chat AI belum tersambung di server saat ini. Menu pencarian, keranjang, checkout, dan cek pesanan di atas tetap bisa dipakai ya.',
            actions: fallbackActions,
          }]);
          return;
        }
        if (data.code === 'GLOBOT_NOT_CONFIGURED') {
          setMessages((current) => [...current, {
            role: 'assistant',
            content: 'Fitur chat AI sedang disiapkan, kak. Sambil menunggu, kakak tetap bisa mencari produk atau melanjutkan pesanan lewat menu di atas.',
            actions: fallbackActions,
          }]);
          return;
        }
        throw new Error(data.message || 'Globot belum dapat menjawab saat ini.');
      }
      setMessages((current) => [...current, {
        role: 'assistant',
        content: data.answer,
        products: Array.isArray(data.products) ? data.products.slice(0, 5) : [],
      }]);
    } catch (error) {
      setErrorMessage(error.message || 'Koneksi ke Globot gagal. Coba lagi atau hubungi toko.');
    } finally {
      setLoading(false);
    }
  };

  const showOrderingGuide = () => {
    setMessages((current) => [...current, {
      role: 'assistant',
      content: 'Cara pesan:\n1. Pilih produk dan tambahkan ke keranjang.\n2. Periksa keranjang, lalu lanjut ke checkout.\n3. Isi nama dan nomor WhatsApp aktif, lalu tekan “Pesan & Lanjut ke WhatsApp”.\n4. Konfirmasi pesanan dengan toko. Pesanan diambil dan dibayar di toko.',
      actions: [
        { label: 'Cari produk', to: '/products' },
        ...(totalItems > 0 ? [{ label: 'Lanjut checkout', to: '/checkout' }] : []),
      ],
    }]);
  };

  const welcome = getWelcomeContent(location.pathname, totalItems);
  const cartSummary = items.length
    ? items.slice(0, 5).map((item) => `${item.name} × ${item.qty}`).join(', ')
    : 'Keranjang masih kosong.';
  return (
    <div className={`globot-widget ${isOpen ? 'is-open' : ''}`}>
      {isOpen && (
        <section className="globot-panel" role="dialog" aria-modal="false" aria-labelledby="globot-title">
          <header className="globot-header">
            <div className="globot-header-identity">
              <span className="globot-avatar"><Bot size={23} aria-hidden="true" /></span>
              <div>
                <h2 id="globot-title">Globot</h2>
                <p>Asisten belanja Glosir</p>
              </div>
            </div>
            <button className="globot-close" type="button" aria-label="Tutup Globot" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </header>

          <nav className="globot-quick-links" aria-label="Navigasi belanja">
            <Link to="/products" onClick={() => setIsOpen(false)}><PackageSearch size={16} /> Produk</Link>
            <Link to="/pesanan" onClick={() => setIsOpen(false)}>Cek pesanan</Link>
            <button type="button" onClick={showOrderingGuide}>Cara pesan</button>
          </nav>

          <div className="globot-messages" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 && (
              <section className="globot-welcome-card" aria-label="Bantuan Globot">
                <span className="globot-welcome-icon"><Sparkles size={18} aria-hidden="true" /></span>
                <p className="globot-welcome-eyebrow">ASISTEN BELANJA</p>
                <h3>{welcome.title}</h3>
                <p className="globot-welcome-copy">{welcome.description}</p>
                <div className="globot-suggestions" aria-label="Saran pencarian">
                  {welcome.suggestions.map((suggestion) => {
                    if (suggestion.to) {
                      return <Link key={suggestion.label} to={suggestion.to} onClick={() => setIsOpen(false)}>{suggestion.label}</Link>;
                    }
                    if (suggestion.action === 'guide') {
                      return <button key={suggestion.label} type="button" onClick={showOrderingGuide}>{suggestion.label}</button>;
                    }
                    return <button key={suggestion.label} type="button" disabled={loading} onClick={() => sendMessage(undefined, suggestion.question)}>{suggestion.label}</button>;
                  })}
                </div>
              </section>
            )}
            {messages.map((message, index) => (
              <div className={`globot-message globot-message--${message.role}`} key={`${message.role}-${index}`}>
                <div className="globot-message-bubble">{message.content}</div>
                {message.products?.length > 0 && (
                  <div className="globot-product-results">
                    {message.products.map((product) => (
                      <Link className="globot-product-result" key={product.id} to={`/products/${encodeURIComponent(product.id)}`} onClick={() => setIsOpen(false)}>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.category} · {product.stock > 0 ? 'Stok tersedia' : 'Stok habis'}</small>
                        </span>
                        <b>{formatMoney(product.price)}</b>
                      </Link>
                    ))}
                  </div>
                )}
                {message.actions?.length > 0 && (
                  <div className="globot-message-actions">
                    {message.actions.map((action) => (
                      <Link key={action.to} to={action.to} onClick={() => setIsOpen(false)}>
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="globot-loading" role="status">Globot sedang menyiapkan jawaban…</p>}
            {errorMessage && (
              <div className="globot-error" role="alert">
                <p>{errorMessage}</p>
                <a href={supportUrl} target={supportUrl.startsWith('https://') ? '_blank' : undefined} rel="noreferrer">
                  <MessageCircle size={15} /> Hubungi admin
                </a>
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>

          {totalItems > 0 && (
            <div className="globot-cart-shortcut">
              <ShoppingBag size={16} aria-hidden="true" />
              <span title={cartSummary}>{totalItems} barang · {formatMoney(totalPrice)}</span>
              <Link to="/cart" onClick={() => setIsOpen(false)}>Keranjang</Link>
              <Link to="/checkout" onClick={() => setIsOpen(false)}>Checkout</Link>
            </div>
          )}

          <form className="globot-composer" onSubmit={sendMessage}>
            <label className="globot-sr-only" htmlFor="globot-message-input">Tulis pesan untuk Globot</label>
            <textarea
              id="globot-message-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 1200))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) sendMessage(event);
              }}
              placeholder="Tulis pesan..."
              rows={1}
              maxLength={1200}
              disabled={loading}
            />
            <button type="submit" aria-label="Kirim pesan" disabled={loading || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
          <footer className="globot-footer">
            <span>Jangan kirim nomor pesanan atau data pribadi di chat.</span>
          </footer>
        </section>
      )}
      <button
        className="globot-launcher"
        type="button"
        aria-label={isOpen ? 'Tutup bantuan Globot' : 'Buka bantuan Globot'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={23} /> : <Bot size={25} />}
        <span>{isOpen ? 'Tutup Globot' : 'Chat Globot'}</span>
      </button>
    </div>
  );
}
