import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { subscribeConfirm } from '../utils/confirmService';

export default function ConfirmDialog() {
  const [request, setRequest] = useState(null);

  useEffect(() => subscribeConfirm(setRequest), []);

  useEffect(() => {
    if (!request) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [request]);

  const finish = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  if (!request) return null;
  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(false); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="confirm-dialog-icon"><AlertTriangle size={21} /></div>
        <div className="confirm-dialog-content">
          <h2 id="confirm-dialog-title">{request.title}</h2>
          <p>{request.message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-cancel" onClick={() => finish(false)}><X size={16} /> Tidak</button>
          <button type="button" className="confirm-dialog-submit" onClick={() => finish(true)}><Check size={16} /> Ya, lanjutkan</button>
        </div>
      </section>
    </div>
  );
}
