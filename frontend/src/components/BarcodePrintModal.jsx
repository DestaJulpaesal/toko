import { useState } from 'react';
import { BarcodeSvg } from '../utils/barcodeUtils';

export default function BarcodePrintModal({ isOpen, onClose, product }) {
  const [printCount, setPrintCount] = useState(4);

  if (!isOpen || !product) return null;

  const handlePrint = () => {
    window.print();
  };

  const labels = Array.from({ length: printCount }, (_, i) => i);

  return (
    <div className="scanner-modal-backdrop" onClick={onClose}>
      <div className="barcode-print-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header no-print">
          <div>
            <h3>🖨️ Cetak Label Stiker Barcode</h3>
            <p>Stiker barcode siap tempel pada kemasan barang atau rak toko.</p>
          </div>
          <button className="scanner-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="print-controls no-print">
          <label>
            Jumlah Label:
            <select value={printCount} onChange={(e) => setPrintCount(Number(e.target.value))}>
              <option value={1}>1 Label</option>
              <option value={4}>4 Label (Ukuran Mini)</option>
              <option value={8}>8 Label (Ukuran Sedang)</option>
              <option value={16}>16 Label (1 Lembar Stiker A4)</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ Cetak Sekarang
          </button>
        </div>

        {/* Printable Area */}
        <div className="barcode-labels-sheet printable-area">
          {labels.map((idx) => (
            <div key={idx} className="barcode-sticker-label">
              <div className="sticker-store-name">TOKO GLOSIR</div>
              <div className="sticker-prod-name">{product.name}</div>
              <BarcodeSvg value={product.sku || 'GLS001'} width={150} height={40} showText={true} />
              <div className="sticker-price">
                Rp {Number(product.price || 0).toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>

        <div className="scanner-modal-footer no-print">
          <button className="btn btn-secondary small" onClick={onClose}>Tutup</button>
          <button className="btn btn-primary small" onClick={handlePrint}>🖨️ Cetak</button>
        </div>
      </div>
    </div>
  );
}

