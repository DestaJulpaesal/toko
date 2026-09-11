import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function ParcelCollectionPage() {
  const [participants, setParticipants] = useState([]);
  const [regions, setRegions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [amounts, setAmounts] = useState({});
  const [note, setNote] = useState('');
  const [actualCash, setActualCash] = useState({});
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const currentUser = useMemo(() => { try { return JSON.parse(localStorage.getItem('glosir_user') || 'null'); } catch { return null; } }, []);
  const isManager = currentUser?.role === 'PARCEL_MANAGER';
  const token = localStorage.getItem('glosir_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const load = async () => {
    setLoading(true);
    try {
      const requests = [
        apiFetch('/parcel-participants', { headers }),
        apiFetch('/parcel-collections', { headers }),
      ];
      if (!isManager) requests.push(apiFetch('/parcel-regions', { headers }));
      const [participantResponse, sessionResponse, regionResponse] = await Promise.all(requests);
      const participantData = await participantResponse.json();
      const sessionData = await sessionResponse.json();
      const regionData = regionResponse ? await regionResponse.json() : null;
      if (!participantData.success) throw new Error(participantData.message || 'Peserta gagal dimuat.');
      if (!sessionData.success) throw new Error(sessionData.message || 'Rekap gagal dimuat.');
      setParticipants(participantData.participants || []);
      setSessions(sessionData.sessions || []);
      if (regionData?.success) setRegions(regionData.regions || []);
      if (isManager && currentUser?.regionId) setRegionId(currentUser.regionId);
      if (!isManager && !regionId && regionData?.regions?.length === 1) setRegionId(regionData.regions[0].id);
    } catch (error) {
      setNotice(error.message || 'Data penagihan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const regionParticipants = participants.filter((participant) => !regionId || participant.regionId === regionId);
  const expectedAmount = regionParticipants.reduce((sum, participant) => sum + Number(amounts[participant.id] || 0), 0);
  const regionName = regions.find((region) => region.id === regionId)?.name || sessions.find((session) => session.regionId === regionId)?.regionName || (isManager ? 'Wilayah saya' : 'Pilih wilayah');

  const submit = async (event) => {
    event.preventDefault();
    const entries = Object.entries(amounts).filter(([, amount]) => Number(amount) > 0).map(([participantId, amount]) => ({ participantId, amount: Number(amount) }));
    if (!regionId || !entries.length) { setNotice('Pilih wilayah dan isi minimal satu setoran peserta.'); return; }
    if (!await confirmAction(`Simpan rekap penagihan ${money(expectedAmount)} untuk ${regionName}?`)) return;
    try {
      const response = await apiFetch('/parcel-collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regionId, collectionDate, entries, note }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Rekap gagal disimpan.');
      setNotice('Rekap penagihan berhasil disimpan dan buku peserta diperbarui.');
      setAmounts({}); setNote(''); await load();
    } catch (error) { setNotice(error.message || 'Rekap gagal disimpan.'); }
  };

  const verify = async (session) => {
    const value = Number(actualCash[session.id] ?? window.prompt(`Cash yang diterima dari ${session.regionName}:`, session.expectedAmount));
    if (!Number.isFinite(value) || value < 0) return;
    try {
      const response = await apiFetch(`/parcel-collections/${session.id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actualCash: value }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Verifikasi gagal.');
      setNotice('Serah terima cash berhasil dicatat.'); await load();
    } catch (error) { setNotice(error.message || 'Verifikasi gagal.'); }
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Penagihan Wilayah" />
      <main className="admin-main">
        <header className="admin-header">
          <div><p className="eyebrow light">Buku setoran digital</p><h1>Penagihan Wilayah</h1><p className="admin-subtitle">Catat setoran peserta satu per satu, lalu cocokkan cash manager dengan catatan owner.</p></div>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
        <section className="collection-layout">
          <form className="crud-form-panel collection-entry-panel" onSubmit={submit}>
            <div className="panel-heading"><div><span className="panel-kicker">Kunjungan penagihan</span><h2>Catat setoran peserta</h2></div></div>
            {!isManager && <label>Wilayah<select value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="">Pilih wilayah</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}</select></label>}
            <label>Tanggal penagihan<input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} /></label>
            <div className="collection-region-heading"><strong>{regionName}</strong><span>Total catatan: {money(expectedAmount)}</span></div>
            <div className="collection-participant-list">
              {regionParticipants.map((participant) => <label className="collection-participant-row" key={participant.id}><span><strong>{participant.name}</strong><small>Sisa {money(participant.remainingAmount)} · {participant.customerPhone || participant.participantPhone || 'Tanpa nomor HP'}</small></span><CurrencyInput value={amounts[participant.id] || ''} onValueChange={(value) => setAmounts((current) => ({ ...current, [participant.id]: value }))} placeholder="Rp 0" /></label>)}
              {!loading && !regionParticipants.length && <div className="table-empty">Belum ada peserta di wilayah ini.</div>}
            </div>
            <label>Catatan wilayah<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: penagihan keliling hari Senin" /></label>
            <button className="btn btn-primary full" type="submit">Simpan rekap penagihan</button>
          </form>
          <section className="crud-table-panel collection-history-panel">
            <div className="panel-heading"><div><span className="panel-kicker">Rekap orang tua</span><h2>Serah terima cash</h2></div><span className="dashboard-panel-total">{sessions.length} rekap</span></div>
            <div className="collection-session-list">
              {sessions.map((session) => <article className="collection-session-card" key={session.id}><div className="collection-session-head"><div><strong>{session.regionName}</strong><small>{new Date(session.collectionDate).toLocaleDateString('id-ID')} · Manager {session.managerName || '-'}</small></div><span className={`status-chip ${session.status === 'VERIFIED' ? 'good' : 'warning'}`}>{session.status === 'VERIFIED' ? 'Diterima' : 'Menunggu verifikasi'}</span></div><div className="collection-session-stats"><span>Catatan<strong>{money(session.expectedAmount)}</strong></span><span>Cash diterima<strong>{session.actualCash == null ? '-' : money(session.actualCash)}</strong></span><span>Selisih<strong className={session.difference < 0 ? 'difference-negative' : ''}>{session.difference == null ? '-' : money(session.difference)}</strong></span></div><details><summary>{session.entries.length} peserta · Lihat rincian</summary><div className="collection-entry-details">{session.entries.map((entry) => <div key={entry.id}><span>{entry.participantName}</span><strong>{money(entry.amount)}</strong></div>)}</div></details>{!isManager && session.status !== 'VERIFIED' && <div className="collection-verify-row"><input type="number" min="0" placeholder="Cash diterima" value={actualCash[session.id] || ''} onChange={(event) => setActualCash((current) => ({ ...current, [session.id]: event.target.value }))} /><button type="button" className="btn btn-primary" onClick={() => verify(session)}>Konfirmasi diterima</button></div>}</article>)}
              {!loading && !sessions.length && <div className="table-empty">Belum ada rekap penagihan.</div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
