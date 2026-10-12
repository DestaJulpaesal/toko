import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { subscribeNotice } from '../utils/noticeService';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export default function NoticeToast() {
  const [queue, setQueue] = useState([]);

  useEffect(() => subscribeNotice((notice) => {
    setQueue((current) => [...current, notice]);
  }), []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return undefined;
    const duration = current.type === 'error' ? 4200 : 2800;
    const timer = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  const Icon = ICONS[current.type] || Info;

  return (
    <div className="global-notice-overlay" role="status" aria-live="polite">
      <div className={`global-notice-toast global-notice-${current.type}`}>
        <span className="global-notice-icon"><Icon size={18} /></span>
        <span className="global-notice-message">{current.message}</span>
        <button
          type="button"
          className="global-notice-close"
          onClick={() => setQueue((q) => q.slice(1))}
          aria-label="Tutup pesan"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
