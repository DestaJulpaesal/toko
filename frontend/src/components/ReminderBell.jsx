import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '../services/api';
export default function ReminderBell() {
  const [items, setItems] = useState([]);
  const load = () => apiFetch('/notifications/operational').then((response) => response.json()).then((result) => setItems(result.data || [])).catch(() => setItems([]));
  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);
  const dismiss = async (item) => { if (!item.reminderId) return; await apiFetch(`/finance/reminders/${item.reminderId}/dismiss`, { method: 'PATCH' }); load(); };
  return <div className="reminder-bell"><button type="button" title="Notifikasi operasional" aria-label="Notifikasi operasional"><Bell size={18} />{items.length > 0 && <span>{items.length > 99 ? '99+' : items.length}</span>}</button>{items.length > 0 && <div className="reminder-popover">{items.slice(0, 8).map((item) => <div key={item.id}><strong>{item.title}</strong><small>{item.detail || (item.dueDate ? new Date(item.dueDate).toLocaleDateString('id-ID') : '')}</small>{item.reminderId && <button type="button" aria-label="Tutup reminder" onClick={() => dismiss(item)}>×</button>}</div>)}</div>}</div>;
}
