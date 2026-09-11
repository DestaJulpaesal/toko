import { useEffect, useState } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { subscribeNotice } from '../utils/noticeService';

export default function NoticeToast() {
  const [notice, setNotice] = useState(null);
  useEffect(() => subscribeNotice(setNotice), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return <div className="global-notice-toast" role="status"><span className="global-notice-icon">{notice.type === 'success' ? <CheckCircle2 size={17} /> : <Info size={17} />}</span><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Tutup pesan"><X size={15} /></button></div>;
}
