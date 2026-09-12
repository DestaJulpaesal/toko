import { useState } from 'react';
import { ClipboardList, FileUp, PackagePlus, RefreshCw, Zap, X } from 'lucide-react';
import { PRESET_INDONESIA_GROCERY, parseBulkProductText, parseCsvProductText } from '../utils/barcodeUtils';
import CurrencyInput from './CurrencyInput';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';

export default function BulkProductModal({ isOpen, onClose, onAddProducts, onRefreshProducts, existingProducts = [] }) {
  const [activeTab, setActiveTab] = useState('preset'); // 'preset' | 'paste' | 'upload'
  const [selectedPresets, setSelectedPresets] = useState(() =>
    PRESET_INDONESIA_GROCERY.map((p) => ({ ...p, isSelected: true }))
  );
  const [bulkText, setBulkText] = useState(
    `Beras Pandan Wangi 5kg, 75000, 25, 80000\nMinyak Bimoli 2L, 36000, 30, 39000\nIndomie Kari Ayam 1 Dus, 115000, 15, 122000\nGula Pasir GMP 1kg, 18000, 50, 19500\nKopi Good Day Cappuccino 10s, 19500, 40, 22000`
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!saving) onClose();
  };

  const toggleSelectAll = (checked) => {
    setSelectedPresets((prev) => prev.map((p) => ({ ...p, isSelected: checked })));
  };

  const togglePresetItem = (sku) => {
    setSelectedPresets((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, isSelected: !p.isSelected } : p))
    );
  };

  const handlePriceChange = (sku, val) => {
    setSelectedPresets((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, price: Number(val) || 0 } : p))
    );
  };

  const handleStockChange = (sku, val) => {
    setSelectedPresets((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, stock: Number(val) || 0 } : p))
    );
  };

  const handleWholesalePriceChange = (sku, val) => {
    setSelectedPresets((prev) => prev.map((p) => (p.sku === sku ? { ...p, wholesalePrice: Number(val) || 0 } : p)));
  };

  const handleSavePresets = async () => {
    const itemsToAdd = selectedPresets
      .filter((p) => p.isSelected && availablePresets.some((available) => available.sku === p.sku))
      .map((p) => ({
        id: Date.now() + Math.floor(Math.random() * 10000),
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: p.price,
        wholesalePrice: p.wholesalePrice || null,
        originalPrice: p.originalPrice,
        discountPercent: p.discountPercent || (p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0),
        stock: p.stock,
        status: p.status || 'Aktif',
      }));

    if (!itemsToAdd.length) {
      showNotice('Pilih minimal 1 produk preset.');
      return;
    }

    if (!await confirmAction(`Masukkan ${itemsToAdd.length} produk terpilih ke database?`)) return;

    setSaving(true);
    try { await onAddProducts(itemsToAdd); onClose(); } finally { setSaving(false); }
  };

  const handleSaveBulkText = async () => {
    const parsed = parseBulkProductText(bulkText, existingProducts);
    if (!parsed.length) {
      showNotice('Data tidak valid atau kosong. Masukkan minimal 1 nama produk.');
      return;
    }

    if (!await confirmAction(`Simpan ${parsed.length} produk dari daftar ini?`)) return;

    setSaving(true);
    try { await onAddProducts(parsed); onClose(); } finally { setSaving(false); }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsvProductText(text, existingProducts);
    if (!parsed.length) {
      showNotice('File CSV tidak valid atau kosong. Pastikan header nama/harga/stok ada.');
      return;
    }

    if (!await confirmAction(`Simpan ${parsed.length} produk dari file CSV?`)) return;

    setSaving(true);
    try { await onAddProducts(parsed); onClose(); } finally { setSaving(false); }
  };

  const selectedCount = selectedPresets.filter((p) => p.isSelected).length;
  const availablePresets = selectedPresets.filter((preset) => !existingProducts.some((product) => (
    String(product.sku || '').trim() === String(preset.sku).trim()
      || String(product.name || '').trim().toLowerCase() === String(preset.name).trim().toLowerCase()
  )));
  const availableSelectedCount = availablePresets.filter((p) => p.isSelected).length;

  return (
    <div className="scanner-modal-backdrop" onClick={handleClose}>
      <div className="bulk-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div>
            <h3>📦 Tambah Cepat Banyak Barang Sekaligus</h3>
            <p>Tidak perlu cape ngetik satu-satu! Pilih sembako populer atau tempel daftar barang.</p>
          </div>
          <button className="scanner-close-btn" onClick={handleClose} disabled={saving} title="Tutup" aria-label="Tutup"><X size={18} /></button>
        </div>

        {/* Tab Navigation */}
        <div className="bulk-tabs-bar">
          <button
            className={`bulk-tab-btn ${activeTab === 'preset' ? 'active' : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            <Zap size={15} /> Katalog Sembako Siap Pakai (Barcode Otomatis)
          </button>
          <button
            className={`bulk-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            <ClipboardList size={15} /> Paste / Salin Daftar Barang (Multi-Item)
          </button>
          <button
            className={`bulk-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <FileUp size={15} /> Upload CSV
          </button>
        </div>

        {/* Tab 1: Preset Catalog */}
        {activeTab === 'preset' && (
          <div className="bulk-tab-content">
            <div className="bulk-preset-toolbar">
              <label className="bulk-select-all">
                <input
                  type="checkbox"
                  checked={selectedCount === selectedPresets.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
                <strong>Pilih Semua ({availableSelectedCount}/{availablePresets.length} Barang Baru)</strong>
              </label>
              <div className="bulk-preset-toolbar-actions">
                <span className="bulk-info-pill">Barcode pabrik & harga rekomendasi sudah terisi otomatis</span>
                <button type="button" className="bulk-refresh-btn" onClick={onRefreshProducts} title="Muat ulang produk dari database">
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>

            <div className="bulk-preset-table-wrap">
              <table className="bulk-preset-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Pilih</th>
                    <th>Nama Barang & Barcode</th>
                    <th>Kategori</th>
                    <th>Harga Eceran (Rp)</th>
                    <th>Harga Warung (Rp)</th>
                    <th>Harga Coret (Rp)</th>
                    <th>Stok Awal</th>
                  </tr>
                </thead>
                  <tbody>
                  {availablePresets.map((item) => (
                    <tr key={item.sku} className={item.isSelected ? 'selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={() => togglePresetItem(item.sku)}
                        />
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="bulk-sku-badge">Barcode: {item.sku}</div>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <CurrencyInput
                          className="bulk-table-input"
                          value={item.price}
                          onValueChange={(value) => handlePriceChange(item.sku, value)}
                        />
                      </td>
                      <td>
                        <CurrencyInput
                          className="bulk-table-input"
                          value={item.wholesalePrice || ''}
                          onValueChange={(value) => handleWholesalePriceChange(item.sku, value)}
                          placeholder="Opsional"
                        />
                      </td>
                      <td>
                        <CurrencyInput
                          className="bulk-table-input"
                          value={item.originalPrice || ''}
                          placeholder="Opsional"
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="bulk-table-input small"
                          value={item.stock}
                          onChange={(e) => handleStockChange(item.sku, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  {!availablePresets.length && <tr><td colSpan="7" className="table-empty">Semua preset ini sudah ada di database. Gunakan Paste atau Upload CSV untuk barang baru.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="bulk-modal-actions">
                <button className="btn btn-secondary small" onClick={handleClose} disabled={saving}>Batal</button>
                  <button className="btn btn-primary" onClick={handleSavePresets} disabled={saving || availableSelectedCount === 0}>
                <PackagePlus size={16} /> Masukkan {availableSelectedCount} Barang Terpilih Sekaligus
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Paste List */}
        {activeTab === 'paste' && (
          <div className="bulk-tab-content">
            <div className="bulk-paste-guide">
              <strong>Format per baris:</strong> <code>Nama Barang, Harga Eceran, Stok, [Harga Warung], [Harga Coret], [Barcode]</code>
              <p>Harga warung boleh dikosongkan. SKU internal dibuat otomatis dan barcode boleh dikosongkan.</p>
            </div>

            <textarea
              className="bulk-textarea"
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Contoh:&#10;Beras Ramos 5kg, 72000, 20, 75000, 8993189211054&#10;Minyak Sania 2L, 35000, 30, 39000&#10;Indomie Goreng Dus, 115000, 15"
            />

            <div className="bulk-modal-actions">
              <button className="btn btn-secondary small" onClick={handleClose} disabled={saving}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveBulkText} disabled={saving}>
                <PackagePlus size={16} /> Simpan Semua Barang
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: CSV Upload */}
        {activeTab === 'upload' && (
          <div className="bulk-tab-content">
            <div className="bulk-paste-guide">
              <strong>Upload file CSV</strong>
              <p>Gunakan header seperti: <code>Nama, Harga Jual, Harga Warung, Stok, Harga Normal, Barcode</code></p>
            </div>

            <label className="bulk-file-picker">
              <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} />
            </label>

            <div className="bulk-modal-actions">
              <button className="btn btn-secondary small" onClick={onClose} disabled={saving}>Batal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

