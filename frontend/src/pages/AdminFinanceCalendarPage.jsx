import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
export default function AdminFinanceCalendarPage() {
  const navigate = useNavigate();
  const { date: detailDate } = useParams();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState({});
  useEffect(() => {
    const targetMonth = detailDate ? detailDate.slice(0, 7) : month;
    if (detailDate && targetMonth !== month) setMonth(targetMonth);
    const [year, value] = targetMonth.split('-');
    apiFetch(`/finance/calendar?month=${value}&year=${year}`).then((response) => response.json()).then((result) => setDays(result.data || {}));
  }, [month, detailDate]);
  const [year, currentMonth] = month.split('-').map(Number); const total = new Date(year, currentMonth, 0).getDate();
  const detailItems = detailDate ? (days[detailDate] || []) : [];
  if (detailDate) {
    return <AdminShell active="Kalender Keuangan" className="admin-crud-shell">
      <header className="admin-header calendar-detail-header">
        <div>
          <p className="eyebrow light">Finance calendar</p>
          <h1>Detail Kalender</h1>
          <p className="admin-subtitle">{new Date(`${detailDate}T00:00:00`).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
        </div>
        <button type="button" className="btn secondary" onClick={() => navigate('/admin/finance/calendar')}>← Kembali ke kalender</button>
      </header>
      <section className="calendar-detail-page">
        <div className="calendar-detail-page-heading">
          <span className="panel-kicker">Aktivitas tanggal</span>
          <strong>{detailItems.length} data tercatat</strong>
        </div>
        {detailItems.length ? <div className="calendar-detail-list">{detailItems.map((item) => <article key={`${item.kind}-${item.id}`}><span className={`calendar-badge ${item.kind.toLowerCase()}`}>{item.kind}</span><strong>{item.title || item.description || 'Data keuangan'}</strong><p>{item.description || 'Tidak ada keterangan tambahan.'}</p></article>)}</div> : <div className="table-empty">Tidak ada data keuangan pada tanggal ini.</div>}
      </section>
    </AdminShell>;
  }
  return <AdminShell active="Kalender Keuangan" className="admin-crud-shell"><header className="admin-header"><div><p className="eyebrow light">Finance calendar</p><h1>Kalender Keuangan</h1></div><input type="month" value={month} onChange={(event) => { setMonth(event.target.value); navigate('/admin/finance/calendar'); }} /></header><section className="calendar-grid">{Array.from({ length: total }, (_, index) => { const day = index + 1; const key = `${year}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return <button type="button" key={key} className={`calendar-cell ${(days[key] || []).length ? 'has-calendar-data' : ''}`} onClick={() => navigate(`/admin/finance/calendar/${key}`)}><strong>{day}</strong>{(days[key] || []).map((item) => <small key={`${item.kind}-${item.id}`} className={`calendar-badge ${item.kind.toLowerCase()}`}>{item.description || item.title || item.kind}</small>)}</button>; })}</section></AdminShell>;
}
