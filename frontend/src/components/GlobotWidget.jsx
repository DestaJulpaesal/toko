import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, ExternalLink, MessageCircle, Send, ShoppingBag, X } from 'lucide-react';
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

function getDefaultHelpMessage(pathname) {
  if (pathname.startsWith('/products/')) return 'Halo kak! Ada produk yang sedang dilihat? Tanyakan harga atau stoknya, atau sebutkan produk yang ingin dicari.';
  if (pathname === '/cart' || pathname === '/checkout') return 'Halo kak! Aku bisa bantu memahami langkah pemesanan. Untuk menyelesaikan transaksi, gunakan alur checkout resmi di halaman ini.';
  return 'Halo kak! Aku Globot, siap bantu cari produk atau menjelaskan cara berbelanja di Glosir.';
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

  const sendMessage = async (event) => {
    event?.preventDefault();
    const content = input.trim();
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
            actions: [
              { label: 'Buka katalog', to: '/products' },
              { label: 'Ke keranjang', to: '/cart' },
            ],
          }]);
          return;
        }
        if (data.code === 'GLOBOT_NOT_CONFIGURED') {
          setMessages((current) => [...current, {
            role: 'assistant',
            content: 'Fitur chat AI sedang disiapkan, kak. Sambil menunggu, kakak tetap bisa mencari produk atau melanjutkan pesanan lewat menu di atas.',
            actions: [
              { label: 'Buka katalog', to: '/products' },
              { label: 'Ke keranjang', to: '/cart' },
            ],
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
      content: 'Cara pesan: pilih produk dari katalog, tambahkan ke keranjang, lalu lanjut ke halaman checkout. Isi nama dan nomor WhatsApp untuk membuat pesanan dan meneruskan konfirmasi melalui WhatsApp.',
      actions: [
        { label: 'Lihat katalog', to: '/products' },
        { label: 'Buka keranjang', to: '/cart' },
        { label: 'Lanjut checkout', to: '/checkout' },
      ],
    }]);
  };

  const cartSummary = items.length
    ? items.slice(0, 5).map((item) => `${item.name} × ${item.qty}`).join(', ')
    : 'Keranjang masih kosong.';
  const conversation = messages.length ? messages : [
    { role: 'assistant', content: getDefaultHelpMessage(location.pathname) },
  ];

  return (
    <div className={`globot-widget ${isOpen ? 'is-open' : ''}`}>
      {isOpen && (
        <section className="globot-panel" role="dialog" aria-modal="false" aria-labelledby="globot-title">
          <header className="globot-header">
            <div className="globot-header-identity">
              <span className="globot-avatar"><Bot size={21} aria-hidden="true" /></span>
              <div>
                <h2 id="globot-title">Globot</h2>
                <p>Asisten Glosir</p>
              </div>
            </div>
            <button className="globot-close" type="button" aria-label="Tutup Globot" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </header>

          <nav className="globot-quick-links" aria-label="Navigasi belanja">
            <Link to="/products" onClick={() => setIsOpen(false)}>Cari produk</Link>
            <button type="button" onClick={showOrderingGuide}>Cara pesan</button>
            <Link to="/cart" onClick={() => setIsOpen(false)}>Keranjang <span>{totalItems}</span></Link>
            <Link to="/checkout" onClick={() => setIsOpen(false)}>Checkout</Link>
            <Link to="/pesanan" onClick={() => setIsOpen(false)}>Cek pesanan</Link>
          </nav>

          <div className="globot-messages" aria-live="polite" aria-relevant="additions text">
            {conversation.map((message, index) => (
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
              <Link to="/cart" onClick={() => setIsOpen(false)}>Lihat keranjang</Link>
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
            <Link to="/checkout" onClick={() => setIsOpen(false)} aria-label="Buka halaman checkout">
              <ExternalLink size={13} />
            </Link>
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
