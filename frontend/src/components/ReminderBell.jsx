import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { getReadNotificationIds } from '../utils/notificationReadStore';
export default function ReminderBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const load = () => apiFetch('/notifications/operational').then((response) => response.json()).then((result) => {
    const readIds = getReadNotificationIds();
    setItems((result.data || []).filter((item) => !readIds.has(item.id)));
  }).catch(() => setItems([]));
  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const handleNotificationsRead = () => setItems([]);
    window.addEventListener('glosir-notifications-read', handleNotificationsRead);
    return () => window.removeEventListener('glosir-notifications-read', handleNotificationsRead);
  }, []);
  return <div className="reminder-bell">
    <button type="button" title="Buka semua notifikasi" aria-label={`Buka notifikasi${items.length ? `, ${items.length} belum ditangani` : ''}`} onClick={() => { setItems([]); navigate('/notifikasi'); }}>
      <Bell size={18} />
      {items.length > 0 && <span>{items.length > 99 ? '99+' : items.length}</span>}
    </button>
  </div>;
}
