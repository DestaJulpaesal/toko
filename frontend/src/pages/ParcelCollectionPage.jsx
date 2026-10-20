import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Search, Users } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const localDateValue = () => {
  const now = new Date();
  const localOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - localOffset).toISOString().slice(0, 10);
};

export default function ParcelCollectionPage() {
  const [participants, setParticipants] = useState([]);
  const [regions, setRegions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [collectionDate, setCollectionDate] = useState(localDateValue);
  const [amounts, setAmounts] = useState({});
  const [participantSearch, setParticipantSearch] = useState('');
  const [note, setNote] = useState('');
  const [actualCash, setActualCash] = useState({});
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState('');
  const currentUser = useMemo(() => { try { return JSON.parse(localStorage.getItem('glosir_user') || 'null'); } catch { return null; } }, []);
  const isManager = currentUser?.role === 'PARCEL_MANAGER';
  const token = localStorage.getItem('glosir_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const load = async () => {
    setLoading(true);
    try {
      const loadResource = async (path, label, update) => {
        const response = await apiFetch(path, { headers });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || `${label} gagal dimuat.`);
        update(data);
      };
      const requests = [
        loadResource('/parcel-participants', 'Data peserta', (data) => setParticipants(data.participants || [])),
        loadResource('/parcel-collections', 'Rekap penagihan', (data) => setSessions(data.sessions || [])),
      ];
      if (!isManager) {
        requests.push(loadResource('/parcel-regions', 'Data wilayah', (data) => {
          setRegions(data.regions || []);
          if (!regionId && data.regions?.length === 1) setRegionId(data.regions[0].id);
        }));
      } else if (currentUser?.regionId) {
        setRegionId(currentUser.regionId);
      }
      const results = await Promise.allSettled(requests);
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) {
        console.error('Some parcel collection data failed to load:', failures.map((result) => result.reason));
        setNotice(`Sebagian data penagihan gagal dimuat (${failures.length} bagian).`);
      }
    } catch (error) {
      setNotice(error.message || 'Data penagihan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const regionParticipants = participants.filter((participant) => regionId && participant.regionId === regionId);
  const visibleParticipants = regionParticipants.filter((participant) => {
    const term = participantSearch.trim().toLowerCase();
    return !term || `${participant.name || ''} ${participant.customerPhone || participant.participantPhone || ''}`.toLowerCase().includes(term);
  });
  const expectedAmount = regionParticipants.reduce((sum, participant) => sum + Number(amounts[participant.id] || 0), 0);
  const enteredCount = regionParticipants.filter((participant) => Number(amounts[participant.id]) > 0).length;
  const pendingSessions = sessions.filter((session) => session.status !== 'VERIFIED').length;
  const regionName = regions.find((region) => region.id === regionId)?.name || sessions.find((session) => session.regionId === regionId)?.regionName || (isManager ? 'Wilayah saya' : 'Pilih wilayah');

  const submit = async (event) => {
    event.preventDefault();
    const activeParticipantIds = new Set(regionParticipants.map((participant) => participant.id));
    const entries = Object.entries(amounts)
      .filter(([participantId, amount]) => activeParticipantIds.has(participantId) && Number(amount) > 0)
      .map(([participantId, amount]) => ({ participantId, amount: Number(amount) }));
    if (!regionId || !entries.length) { setNotice('Pilih wilayah dan isi minimal satu setoran peserta.'); return; }
    if (!await confirmAction(`Simpan rekap penagihan ${money(expectedAmount)} untuk ${regionName}?`)) return;
    setSaving(true);
    try {
      const response = await apiFetch('/parcel-collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regionId, collectionDate, entries, note }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Rekap gagal disimpan.');
      setNotice('Rekap penagihan berhasil disimpan dan buku peserta diperbarui.');
      setAmounts({}); setNote(''); await load();
    } catch (error) { setNotice(error.message || 'Rekap gagal disimpan.'); }
    finally { setSaving(false); }
  };

  const verify = async (session) => {
    const enteredCash = actualCash[session.id];
    const promptedCash = enteredCash == null || enteredCash === ''
      ? window.prompt(`Cash yang diterima dari ${session.regionName}:`, session.expectedAmount)
      : enteredCash;
    if (promptedCash == null || promptedCash === '') return;
    const value = Number(promptedCash);
    if (!Number.isFinite(value) || value < 0) return;
    setVerifyingId(session.id);
    try {
      const response = await apiFetch(`/parcel-collections/${session.id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actualCash: value }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Verifikasi gagal.');
      setNotice('Serah terima cash berhasil dicatat.'); await load();
    } catch (error) { setNotice(error.message || 'Verifikasi gagal.'); }
    finally { setVerifyingId(''); }
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Penagihan Wilayah" />
      <main className="admin-main">
        <header className="admin-header">
          <div><p className="eyebrow light">Buku setoran digital</p><h1>Penagihan Wilayah</h1><p className="admin-subtitle">Catat setoran peserta, lalu cocokkan uang yang terkumpul dengan rekap penagihan.</p></div>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
        <section className="collection-overview" aria-label="Ringkasan penagihan">
          <div><span className="collection-overview-icon"><Users size={17} /></span><span><small>Peserta di wilayah</small><strong>{regionId ? regionParticipants.length : '—'}</strong></span></div>
          <div><span className="collection-overview-icon is-green"><CheckCircle2 size={17} /></span><span><small>Setoran diinput</small><strong>{enteredCount} peserta · {money(expectedAmount)}</strong></span></div>
          <div><span className="collection-overview-icon is-amber"><Clock3 size={17} /></span><span><small>Menunggu konfirmasi</small><strong>{pendingSessions} rekap</strong></span></div>
        </section>
        <section className="collection-layout">
          <form className="crud-form-panel collection-entry-panel" onSubmit={submit}>
            <div className="panel-heading"><div><span className="panel-kicker">Kunjungan penagihan</span><h2>Catat setoran</h2><p className="collection-panel-hint">Isi nominal yang dibayarkan setiap peserta. Peserta yang tidak membayar boleh dikosongkan.</p></div></div>
            {!isManager && <label>Wilayah<select value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="">Pilih wilayah</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}</select></label>}
            <label className="collection-date-label"><span><CalendarDays size={14} /> Tanggal penagihan</span><input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} /></label>
            <div className="collection-region-heading"><span><strong>{regionName}</strong><small>{enteredCount} dari {regionParticipants.length} peserta diisi</small></span><b>{money(expectedAmount)}</b></div>
            <label className="collection-search"><Search size={16} /><input type="search" value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Cari nama atau nomor HP" aria-label="Cari peserta berdasarkan nama atau nomor HP" /></label>
            <div className="collection-participant-list">
              {visibleParticipants.map((participant) => <label className={`collection-participant-row${Number(amounts[participant.id]) > 0 ? ' has-amount' : ''}`} key={participant.id}><span><strong>{participant.name}</strong><small>Sisa tagihan {money(participant.remainingAmount)}{(participant.customerPhone || participant.participantPhone) ? ` · ${participant.customerPhone || participant.participantPhone}` : ''}</small></span><CurrencyInput value={amounts[participant.id] || ''} onValueChange={(value) => setAmounts((current) => ({ ...current, [participant.id]: value }))} placeholder="Rp 0" aria-label={`Setoran ${participant.name}`} /></label>)}
              {!loading && !regionParticipants.length && <div className="collection-empty-state"><Users size={22} /><strong>{regionId ? 'Belum ada peserta di wilayah ini' : 'Pilih wilayah terlebih dahulu'}</strong><span>{regionId ? 'Peserta yang terdaftar di wilayah ini akan muncul di sini.' : 'Pilih wilayah untuk melihat daftar peserta dan mencatat setoran.'}</span></div>}
              {!loading && regionParticipants.length > 0 && !visibleParticipants.length && <div className="collection-empty-state"><Search size={22} /><strong>Peserta tidak ditemukan</strong><span>Coba gunakan nama atau nomor HP yang berbeda.</span></div>}
              {loading && <div className="collection-empty-state" role="status">Memuat daftar peserta...</div>}
            </div>
            <label>Catatan wilayah<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: penagihan keliling hari Senin" /></label>
            <div className="collection-submit-row">{enteredCount > 0 && <button className="collection-clear-button" type="button" onClick={() => setAmounts({})}>Kosongkan nominal</button>}<button className="btn btn-primary full" type="submit" disabled={saving || loading || enteredCount === 0}>{saving ? 'Menyimpan rekap...' : `Simpan rekap · ${money(expectedAmount)}`}</button></div>
          </form>
          <section className="crud-table-panel collection-history-panel">
            <div className="panel-heading"><div><span className="panel-kicker">Pemeriksaan & serah terima</span><h2>Rekap penagihan</h2><p className="collection-panel-hint">Periksa total dari manager dan catat uang tunai yang diterima.</p></div><span className="dashboard-panel-total">{sessions.length} rekap</span></div>
            <div className="collection-session-list">
              {sessions.map((session) => <article className="collection-session-card" key={session.id}><div className="collection-session-head"><div><strong>{session.regionName}</strong><small>{new Date(session.collectionDate).toLocaleDateString('id-ID')} · Manager {session.managerName || '-'}</small></div><span className={`status-chip ${session.status === 'VERIFIED' ? 'good' : 'warning'}`}>{session.status === 'VERIFIED' ? 'Diterima' : 'Perlu verifikasi'}</span></div><div className="collection-session-stats"><span>Total setoran<strong>{money(session.expectedAmount)}</strong></span><span>Cash diterima<strong>{session.actualCash == null ? 'Belum diterima' : money(session.actualCash)}</strong></span><span>Selisih<strong className={session.difference < 0 ? 'difference-negative' : ''}>{session.difference == null ? '-' : money(session.difference)}</strong></span></div><details><summary>{session.entries.length} peserta · Lihat rincian</summary><div className="collection-entry-details">{session.entries.map((entry) => <div key={entry.id}><span>{entry.participantName}</span><strong>{money(entry.amount)}</strong></div>)}</div></details>{!isManager && session.status !== 'VERIFIED' && <div className="collection-verify-row"><label><span>Uang tunai diterima</span><input type="number" min="0" inputMode="numeric" placeholder="Masukkan nominal" value={actualCash[session.id] || ''} onChange={(event) => setActualCash((current) => ({ ...current, [session.id]: event.target.value }))} /></label><button type="button" className="btn btn-primary" disabled={verifyingId === session.id} onClick={() => verify(session)}>{verifyingId === session.id ? 'Menyimpan...' : 'Konfirmasi cash'}</button></div>}</article>)}
              {!loading && !sessions.length && <div className="collection-empty-state"><CheckCircle2 size={24} /><strong>Belum ada rekap penagihan</strong><span>Setelah manager menyimpan setoran, rekap akan tampil di sini untuk diperiksa.</span></div>}
              {loading && <div className="collection-empty-state" role="status">Memuat rekap penagihan...</div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
