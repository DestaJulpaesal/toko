import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { ScanLine } from 'lucide-react';
import { playBeep } from '../utils/barcodeUtils';

export default function BarcodeScannerModal({ isOpen, onClose, onDetected }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const statusTimerRef = useRef(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [scanStatus, setScanStatus] = useState('Menyiapkan kamera...');
  const [cameraDevices, setCameraDevices] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async (deviceId = undefined) => {
    setErrorMessage('');
    setHasCamera(true);
    setScanStatus('Meminta izin kamera...');
    stopCamera();
    try {
      readerRef.current = new BrowserMultiFormatReader();
      const handleResult = (result) => {
        if (result) {
          setScanStatus(`Barcode terbaca: ${result.getText()}`);
          handleSuccess(result.getText());
        }
      };

      try {
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(deviceId, videoRef.current, handleResult);
      } catch {
        controlsRef.current = await readerRef.current.decodeFromConstraints(
          { video: deviceId ? { deviceId: { exact: deviceId } } : true },
          videoRef.current,
          handleResult
        );
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(devices.filter((device) => device.kind === 'videoinput'));
      setScanStatus('Kamera aktif. Arahkan barcode ke garis merah...');
      statusTimerRef.current = setTimeout(() => {
        setScanStatus('Belum terbaca. Dekatkan barcode, pastikan fokus dan cahaya cukup.');
      }, 8000);
    } catch (err) {
      setHasCamera(false);
      setScanStatus('Kamera gagal dibuka');
      setErrorMessage(
        'Kamera tidak dapat diakses. Pastikan izin kamera diberikan untuk localhost, lalu coba lagi. Anda juga bisa memasukkan barcode secara manual.'
      );
    }
  };

  const stopCamera = () => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    readerRef.current = null;
  };

  const handleSuccess = (code) => {
    playBeep(1400, 0.12);
    stopCamera();
    onDetected(code);
    onClose();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleSuccess(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-backdrop" onClick={onClose}>
      <div className="scanner-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div>
            <h3><ScanLine size={18} /> Scan Barcode Produk</h3>
            <p>Arahkan kamera ke barcode kemasan barang atau gunakan scanner gun.</p>
          </div>
          <button className="scanner-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="scanner-camera-viewport">
          {hasCamera ? (
            <>
              <video ref={videoRef} className="scanner-video" playsInline muted />
              <div className="scanner-target-reticle">
                <div className="scanner-laser-line" />
                <span className="scanner-tip">Sejajarkan garis merah dengan garis barcode kemasan</span>
              </div>
            </>
          ) : (
            <div className="scanner-no-camera">
              <ScanLine size={48} strokeWidth={1.5} />
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        {hasCamera && (
          <div className="scanner-notice-banner">
            <span>💡 {scanStatus} Pastikan pencahayaan cukup dan jarak sekitar 15–30 cm. Scanner USB juga bisa langsung dipakai di kolom bawah.</span>
          </div>
        )}

        {hasCamera && cameraDevices.length > 1 && (
          <label className="scanner-camera-select">
            Pilih kamera
            <select onChange={(event) => startCamera(event.target.value)} defaultValue="">
              <option value="">Kamera utama</option>
              {cameraDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Kamera ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Input Manual / Scanner Gun Receiver */}
        <form className="scanner-manual-input-row" onSubmit={handleManualSubmit}>
          <input
            autoFocus
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Ketik / scan pakai scanner gun (contoh: 8998866200213)..."
          />
          <button type="submit" className="btn btn-primary small">
            Gunakan Barcode
          </button>
        </form>

        <div className="scanner-modal-footer">
          <button type="button" className="btn btn-secondary small" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

