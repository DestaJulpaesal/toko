import { useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';

function normalizeLine(value = '') {
  return String(value || '').trim().replace(/^"|"$/g, '');
}

function parseReceiptRows(text = '') {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];

  for (const raw of lines) {
    const cells = raw
      .split(/[,;\t]+/)
      .map((cell) => normalizeLine(cell))
      .filter(Boolean);

    if (cells.length < 3) continue;

    const name = cells[0];
    const qty = Number(cells[1]) || 0;
    const price = Number(cells[2]) || 0;
    const barcode = cells[3] || '';

    if (!name || qty <= 0) continue;

    items.push({
      name,
      quantity: qty,
      price,
      barcode,
    });
  }

  return items;
}

export default function StockReceiptImportModal({ isOpen, onClose, onImport, existingProducts = [] }) {
  const [mode, setMode] = useState('quick');
  const [receiptText, setReceiptText] = useState(
    'Beras Ramos 5kg, 20, 68000, 8993189211054\nMinyak Sania 2L, 12, 32000, 8992775210028\nGula Pasir 1kg, 15, 17000\nKopi Kapal Api, 10, 15000'
  );
  const [previewUrl, setPreviewUrl] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [quickRows, setQuickRows] = useState([]);

  const parsedRows = useMemo(() => parseReceiptRows(receiptText), [receiptText]);
  const quickMatches = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();
    if (!query) return existingProducts.slice(0, 8);
    return existingProducts
      .filter((product) => `${product.name} ${product.sku || ''} ${product.barcode || ''}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [existingProducts, quickSearch]);

  if (!isOpen) return null;

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
  };

  const handleSubmit = async () => {
    const rows = parseReceiptRows(receiptText);
    if (!rows.length) {
      showNotice('Data nota belum valid. Gunakan format: nama, qty, harga, barcode.');
      return;
    }

    if (!await confirmAction(`Simpan ${rows.length} item barang masuk?`)) return;

    const mapped = rows.map((row, index) => ({
      id: Date.now() + index,
      name: row.name,
      sku: `GLS-${Date.now()}-${index + 1}`,
      barcode: row.barcode || '',
      category: 'Glosir',
      price: row.price || 0,
      originalPrice: row.price || null,
      discountPercent: 0,
      stock: row.quantity,
      status: 'Aktif',
    }));

    onImport(mapped);
    onClose();
  };

  const addQuickProduct = (product) => {
    const quantity = Math.max(1, Number(quickQuantity) || 1);
    setQuickRows((current) => {
      const existing = current.find((row) => row.id === product.id);
      if (existing) return current.map((row) => row.id === product.id ? { ...row, quantity: row.quantity + quantity } : row);
      return [...current, { ...product, quantity }];
    });
    setQuickSearch('');
    setQuickQuantity(1);
  };

  const handleQuickSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (quickMatches[0]) addQuickProduct(quickMatches[0]);
    }
  };

  const handleQuickSubmit = async () => {
    if (!quickRows.length) {
      showNotice('Pilih minimal satu produk dan isi jumlah stok masuk.');
      return;
    }
    if (!await confirmAction(`Simpan stok masuk untuk ${quickRows.length} produk?`)) return;
    onImport(quickRows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode || '',
      category: row.category || 'Glosir',
      price: Number(row.price || 0),
      originalPrice: row.originalPrice || row.price || null,
      stock: row.quantity,
      status: row.status || 'Aktif',
    })));
    setQuickRows([]);
    onClose();
  };

  return (
    <div className="scanner-modal-backdrop" onClick={onClose}>
      <div className="bulk-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div>
            <h3>📸 Barang Masuk / Nota Pembelian</h3>
            <p>Masukkan stok baru dari foto nota, struk, atau copy paste data pembelian.</p>
          </div>
          <button type="button" className="scanner-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="bulk-tabs-bar">
          <button type="button" className={`bulk-tab-btn ${mode === 'quick' ? 'active' : ''}`} onClick={() => setMode('quick')}>
            ⚡ Stok Cepat
          </button>
          <button type="button" className={`bulk-tab-btn ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>
            📝 Paste Teks Nota
          </button>
          <button type="button" className={`bulk-tab-btn ${mode === 'photo' ? 'active' : ''}`} onClick={() => setMode('photo')}>
            <Camera size={16} /> Foto Nota / Struk
          </button>
        </div>

        {mode === 'quick' && (
          <div className="bulk-tab-content stock-quick-content">
            <div className="bulk-paste-guide">
              <strong>Tambah stok tanpa mengetik nama barang.</strong>
              <p>Ketik sebagian nama, SKU, atau scan barcode ke kolom pencarian lalu tekan Enter.</p>
            </div>

            <div className="stock-quick-search-row">
              <input
                autoFocus
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                onKeyDown={handleQuickSearchKeyDown}
                placeholder="Cari atau scan barcode produk..."
              />
              <input
                type="number"
                min="1"
                value={quickQuantity}
                onChange={(event) => setQuickQuantity(event.target.value)}
                aria-label="Jumlah stok masuk"
              />
              <button type="button" className="btn btn-primary" onClick={() => quickMatches[0] && addQuickProduct(quickMatches[0])}>
                Tambah
              </button>
            </div>

            {quickSearch && quickMatches.length > 0 && (
              <div className="stock-quick-results">
                {quickMatches.map((product) => (
                  <button type="button" key={product.id} onClick={() => addQuickProduct(product)}>
                    <strong>{product.name}</strong>
                    <small>{product.barcode || product.sku || 'Tanpa barcode'} · Stok saat ini: {product.stock ?? 0}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="stock-quick-list">
              {quickRows.length === 0 && <p className="table-empty">Belum ada produk yang dipilih.</p>}
              {quickRows.map((row) => (
                <div className="stock-quick-item" key={row.id}>
                  <div><strong>{row.name}</strong><small>{row.barcode || row.sku}</small></div>
                  <div className="stock-quick-quantity">
                    <button type="button" onClick={() => setQuickRows((current) => current.map((item) => item.id === row.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>-</button>
                    <strong>{row.quantity}</strong>
                    <button type="button" onClick={() => setQuickRows((current) => current.map((item) => item.id === row.id ? { ...item, quantity: item.quantity + 1 } : item))}>+</button>
                  </div>
                  <button type="button" className="text-button" onClick={() => setQuickRows((current) => current.filter((item) => item.id !== row.id))}>Hapus</button>
                </div>
              ))}
            </div>

            <div className="bulk-modal-actions">
              <button type="button" className="btn btn-secondary small" onClick={onClose}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={handleQuickSubmit}>Simpan Stok Masuk</button>
            </div>
          </div>
        )}

        {mode === 'paste' && (
          <div className="bulk-tab-content">
            <div className="bulk-paste-guide">
              <strong>Format per baris:</strong> <code>Nama Barang, Jumlah, Harga Beli, [Barcode]</code>
              <p>Contoh: <code>Beras Ramos 5kg, 20, 68000, 8993189211054</code></p>
            </div>

            <textarea
              className="bulk-textarea"
              rows={8}
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
            />

            <div className="bulk-modal-actions">
              <button type="button" className="btn btn-secondary small" onClick={onClose}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                ✅ Simpan Barang Masuk
              </button>
            </div>
          </div>
        )}

        {mode === 'photo' && (
          <div className="bulk-tab-content">
            <label className="bulk-file-picker">
              <input type="file" accept="image/*" onChange={handleFileUpload} />
            </label>

            {previewUrl && (
              <div style={{ marginTop: '12px' }}>
                <img src={previewUrl} alt="Preview nota" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '10px', background: '#f3f4f6' }} />
              </div>
            )}

            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <strong>Catatan</strong>
              <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
                Foto nota membantu sebagai bukti pembelian. Untuk proses otomatis yang lebih presisi, paste teks hasil foto/scan ke form diatas lalu simpan.
              </p>
            </div>

            <div className="bulk-modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary small" onClick={onClose}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                ✅ Gunakan Data Nota Ini
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '12px', fontSize: '0.82rem', color: '#374151' }}>
          <strong>Preview data terdeteksi:</strong> {parsedRows.length ? `${parsedRows.length} item` : 'Belum ada data'}
        </div>
      </div>
    </div>
  );
}
