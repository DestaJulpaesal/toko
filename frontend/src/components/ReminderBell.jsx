import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '../services/api';
export default function ReminderBell() {
  const [items, setItems] = useState([]);
  const load = () => apiFetch('/finance/reminders?status=PENDING').then((response) => response.json()).then((result) => setItems(result.data || [])).catch(() => setItems([]));
  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);
  const dismiss = async (id) => { await apiFetch(`/finance/reminders/${id}/dismiss`, { method: 'PATCH' }); load(); };
  return <div className="reminder-bell"><button type="button" title="Reminder keuangan" aria-label="Reminder keuangan"><Bell size={18} />{items.length > 0 && <span>{items.length > 99 ? '99+' : items.length}</span>}</button>{items.length > 0 && <div className="reminder-popover">{items.slice(0, 5).map((item) => <div key={item.id}><strong>{item.title}</strong><small>{new Date(item.dueDate).toLocaleDateString('id-ID')}</small><button type="button" onClick={() => dismiss(item.id)}>×</button></div>)}</div>}</div>;
}
