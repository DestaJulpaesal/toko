import PropTypes from 'prop-types';

export default function CashierHelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="pos-help-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="pos-help-title">
      <div className="pos-help-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="pos-help-header">
          <div className="pos-help-title-wrap">
            <span className="pos-help-icon-badge">💡</span>
            <div>
              <h2 id="pos-help-title">Panduan Cepat Kasir Glosir</h2>
              <p>3 Langkah mudah melayani pelanggan di kasir</p>
            </div>
          </div>
          <button
            type="button"
            className="pos-help-close-btn"
            onClick={onClose}
            aria-label="Tutup panduan bantuan"
          >
            ×
          </button>
        </div>

        {/* 3 Illustrated Steps */}
        <div className="pos-help-steps-grid">
          {/* Langkah 1 */}
          <div className="pos-step-card">
            <div className="pos-step-badge step-1">Langkah 1</div>
            <div className="pos-step-illustration illustration-scan">
              <svg viewBox="0 0 100 80" className="pos-step-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Barcode lines */}
                <rect x="18" y="18" width="4" height="44" fill="#0f172a" rx="1" />
                <rect x="26" y="18" width="8" height="44" fill="#0f172a" rx="1" />
                <rect x="38" y="18" width="4" height="44" fill="#0f172a" rx="1" />
                <rect x="46" y="18" width="6" height="44" fill="#0f172a" rx="1" />
                <rect x="56" y="18" width="10" height="44" fill="#0f172a" rx="1" />
                <rect x="70" y="18" width="4" height="44" fill="#0f172a" rx="1" />
                <rect x="78" y="18" width="6" height="44" fill="#0f172a" rx="1" />
                {/* Red Laser beam */}
                <line x1="8" y1="40" x2="92" y2="40" stroke="#ef4444" strokeWidth="3" strokeDasharray="3 2" />
                {/* Laser glow */}
                <circle cx="50" cy="40" r="7" fill="#ef4444" fillOpacity="0.4" />
                <circle cx="50" cy="40" r="3" fill="#ef4444" />
              </svg>
            </div>
            <div className="pos-step-content">
              <h3>1. Scan Barang</h3>
              <ul className="pos-step-points">
                <li><strong>Arahkan scanner</strong> fisik langsung ke barcode kemasan barang.</li>
                <li>Atau <strong>ketik nama produk / SKU</strong> di kolom pencarian lalu tekan <code>Enter</code>.</li>
                <li>Bisa juga klik tombol <strong>📷 Scan Barcode</strong> untuk scan via kamera HP/laptop.</li>
                <li>Barang otomatis masuk ke daftar belanja dengan bunyi <em>beep</em>.</li>
              </ul>
            </div>
          </div>

          {/* Arrow divider */}
          <div className="pos-step-arrow" aria-hidden="true">➔</div>

          {/* Langkah 2 */}
          <div className="pos-step-card">
            <div className="pos-step-badge step-2">Langkah 2</div>
            <div className="pos-step-illustration illustration-pay">
              <svg viewBox="0 0 100 80" className="pos-step-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Banknote background */}
                <rect x="12" y="20" width="76" height="42" rx="4" fill="#10b981" />
                <rect x="16" y="24" width="68" height="34" rx="2" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" />
                {/* Currency seal */}
                <circle cx="50" cy="41" r="11" fill="#ffffff" fillOpacity="0.25" />
                <circle cx="50" cy="41" r="8" stroke="#ffffff" strokeWidth="1.5" />
                <text x="50" y="45" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">Rp</text>
                {/* Coins stack */}
                <ellipse cx="26" cy="56" rx="8" ry="3" fill="#f59e0b" />
                <ellipse cx="26" cy="53" rx="8" ry="3" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
                <ellipse cx="74" cy="56" rx="8" ry="3" fill="#f59e0b" />
                <ellipse cx="74" cy="53" rx="8" ry="3" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
              </svg>
            </div>
            <div className="pos-step-content">
              <h3>2. Masukkan Nominal Bayar</h3>
              <ul className="pos-step-points">
                <li>Lihat <strong>Total Belanja</strong> yang tertera pada panel kanan.</li>
                <li>Klik tombol praktis <strong>"Uang Pas"</strong> atau pecahan cepat (<em>50rb, 100rb, dll.</em>).</li>
                <li>Atau ketik langsung nominal uang yang diserahkan pembeli.</li>
                <li>Sistem secara otomatis menghitung <strong>kembalian</strong> dengan akurat.</li>
              </ul>
            </div>
          </div>

          {/* Arrow divider */}
          <div className="pos-step-arrow" aria-hidden="true">➔</div>

          {/* Langkah 3 */}
          <div className="pos-step-card">
            <div className="pos-step-badge step-3">Langkah 3</div>
            <div className="pos-step-illustration illustration-print">
              <svg viewBox="0 0 100 80" className="pos-step-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Thermal Printer Body */}
                <rect x="22" y="28" width="56" height="38" rx="6" fill="#1e293b" />
                <rect x="28" y="34" width="44" height="4" rx="2" fill="#334155" />
                {/* Status LED */}
                <circle cx="32" cy="54" r="3" fill="#22c55e" />
                {/* Paper slot & receipt paper rolling out */}
                <path d="M 32 36 L 32 12 Q 32 10 34 10 L 66 10 Q 68 10 68 12 L 68 36 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                {/* Receipt text lines */}
                <line x1="37" y1="16" x2="63" y2="16" stroke="#64748b" strokeWidth="1.5" />
                <line x1="37" y1="20" x2="57" y2="20" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="37" y1="24" x2="61" y2="24" stroke="#94a3b8" strokeWidth="1.5" />
                {/* Success checkmark badge */}
                <circle cx="72" cy="22" r="10" fill="#22c55e" />
                <path d="M 68 22 L 71 25 L 77 19" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="pos-step-content">
              <h3>3. Bayar & Cetak Struk</h3>
              <ul className="pos-step-points">
                <li>Klik tombol hijau besar <strong>"Bayar & Cetak"</strong> (atau tekan <code>Enter</code>).</li>
                <li>Pesanan langsung <strong>tersimpan</strong> ke database transaksi.</li>
                <li><strong>Stok barang otomatis berkurang</strong> dan kas toko bertambah.</li>
                <li>Kotak dialog cetak terbuka otomatis untuk <strong>printer struk kasir</strong>.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Hotkeys and Tips Footer */}
        <div className="pos-help-footer">
          <div className="pos-help-shortcuts">
            <span className="shortcut-title">⌨️ Tips Pintasan Cepat:</span>
            <div className="shortcut-chips">
              <span><kbd>Enter</kbd> Masukkan scan / Selesaikan bayar</span>
              <span><kbd>F11</kbd> Mode Layar Penuh</span>
              <span><kbd>Esc</kbd> Keluar layar penuh / Tutup modal</span>
            </div>
          </div>

          <button
            type="button"
            className="pos-help-understand-btn"
            onClick={onClose}
          >
            ✓ Mengerti, Siap Melayani Pembeli
          </button>
        </div>
      </div>
    </div>
  );
}

CashierHelpModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
