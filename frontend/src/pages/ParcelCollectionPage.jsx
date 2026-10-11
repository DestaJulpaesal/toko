import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [collected, setCollected] = useState({});
  const [detailRegion, setDetailRegion] = useState(null);
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
  const visibleParticipants = regionParticipants.filter((participant) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [participant.name, participant.customerName, participant.customerPhone, participant.participantPhone]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'ALL'
      || (statusFilter === 'PAID' && participant.collectionStatus === 'COMPLETED')
      || (statusFilter === 'OVERDUE' && participant.collectionStatus === 'OVERDUE')
      || (statusFilter === 'UNPAID' && participant.collectionStatus === 'DUE');
    return matchesSearch && matchesStatus;
  });
  const expectedAmount = regionParticipants.reduce((sum, participant) => sum + Number(amounts[participant.id] || 0), 0);
  const recap = regionParticipants.reduce((result, participant) => {
    result.total += 1;
    result.outstanding += Number(participant.remainingAmount || 0);
    if (participant.collectionStatus === 'COMPLETED') result.paid += 1;
    if (participant.collectionStatus === 'OVERDUE') result.overdue += 1;
    return result;
  }, { total: 0, paid: 0, overdue: 0, outstanding: 0 });
  const regionName = regions.find((region) => region.id === regionId)?.name || sessions.find((session) => session.regionId === regionId)?.regionName || (isManager ? 'Wilayah saya' : 'Pilih wilayah');
  const regionCards = useMemo(() => Object.values(sessions.reduce((result, session) => {
    const key = session.regionId || session.regionName || 'unknown';
    if (!result[key]) result[key] = { id: key, name: session.regionName || 'Wilayah tanpa nama', sessions: [] };
    result[key].sessions.push(session);
    return result;
  }, {})), [sessions]);

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

  const markCollected = (participant) => {
    setAmounts((current) => ({ ...current, [participant.id]: current[participant.id] || Math.min(Number(participant.contributionAmount || participant.remainingAmount || 0), Number(participant.remainingAmount || participant.contributionAmount || 0)) }));
    setCollected((current) => ({ ...current, [participant.id]: true }));
  };

  const exportCollectionList = () => {
    const rows = visibleParticipants.map((participant) => [
      participant.name, participant.customerPhone || participant.participantPhone || '',
      participant.regionName || regionName, participant.collectionStatus, participant.overduePeriods || 0,
      participant.remainingAmount || 0, amounts[participant.id] || '',
    ]);
    const csv = [['Nama', 'Nomor', 'Wilayah', 'Status', 'Periode terlambat', 'Sisa', 'Setoran hari ini'], ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `daftar-penagihan-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <AdminShell active="Penagihan Wilayah" className="admin-crud-shell">
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
            <div className="collection-toolbar">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama / nomor..." aria-label="Cari peserta" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status pembayaran">
                <option value="ALL">Semua status</option><option value="PAID">Sudah bayar</option><option value="UNPAID">Belum bayar</option><option value="OVERDUE">Terlambat</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={exportCollectionList}>Export daftar</button>
            </div>
            <div className="collection-region-summary"><span>{recap.total} peserta</span><span>{recap.paid} lunas</span><span>{recap.overdue} terlambat</span><span>Sisa {money(recap.outstanding)}</span></div>
            <div className="collection-participant-list">
              {visibleParticipants.map((participant) => <div className="collection-participant-row" key={participant.id}><span><strong>{participant.name}</strong><small>{participant.collectionStatus === 'OVERDUE' ? `Terlambat ${participant.overduePeriods} periode · ` : ''}Sisa {money(participant.remainingAmount)} · {participant.customerPhone || participant.participantPhone || 'Tanpa nomor HP'}</small></span><CurrencyInput value={amounts[participant.id] || ''} onValueChange={(value) => setAmounts((current) => ({ ...current, [participant.id]: value }))} placeholder="Rp 0" /><button type="button" className="text-button" onClick={() => markCollected(participant)}>{collected[participant.id] ? 'Ditandai' : 'Tandai ditagih'}</button></div>)}
              {!loading && !visibleParticipants.length && <div className="table-empty">Tidak ada peserta sesuai filter.</div>}
            </div>
            <label>Catatan wilayah<textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: penagihan keliling hari Senin" /></label>
            <button className="btn btn-primary full" type="submit">Simpan rekap penagihan</button>
          </form>
          <section className="crud-table-panel collection-history-panel">
            <div className="panel-heading"><div><span className="panel-kicker">Rekap orang tua</span><h2>Serah terima cash</h2></div><span className="dashboard-panel-total">{sessions.length} rekap</span></div>
            <div className="collection-region-card-grid">
              {regionCards.map((region) => {
                const expected = region.sessions.reduce((sum, item) => sum + Number(item.expectedAmount || 0), 0);
                const pending = region.sessions.filter((item) => item.status !== 'VERIFIED').length;
                return <article className="collection-region-card" key={region.id}><div><strong>{region.name}</strong><small>{region.sessions.length} rekap · {pending ? `${pending} menunggu verifikasi` : 'Semua diterima'}</small></div><div className="collection-region-summary"><span>Total catatan<strong>{money(expected)}</strong></span><span>Terakhir<strong>{new Date(region.sessions[0].collectionDate).toLocaleDateString('id-ID')}</strong></span></div><button type="button" className="btn btn-secondary" onClick={() => setDetailRegion(region)}>Lihat detail</button></article>;
              })}
              {!loading && !sessions.length && <div className="table-empty">Belum ada rekap penagihan.</div>}
            </div>
          </section>
        </section>
        {detailRegion && <div className="parcel-collection-modal"><section className="parcel-collection-card collection-detail-panel"><div className="panel-heading"><div><span className="panel-kicker">Detail wilayah</span><h2>{detailRegion.name}</h2></div><button type="button" className="text-button" onClick={() => setDetailRegion(null)}>Tutup</button></div><div className="collection-session-list">{detailRegion.sessions.map((session) => <article className="collection-session-card" key={session.id}><div className="collection-session-head"><div><strong>{new Date(session.collectionDate).toLocaleDateString('id-ID')}</strong><small>Manager {session.managerName || '-'}</small></div><span className={`status-chip ${session.status === 'VERIFIED' ? 'good' : 'warning'}`}>{session.status === 'VERIFIED' ? 'Diterima' : 'Menunggu verifikasi'}</span></div><div className="collection-session-stats"><span>Catatan<strong>{money(session.expectedAmount)}</strong></span><span>Cash diterima<strong>{session.actualCash == null ? '-' : money(session.actualCash)}</strong></span><span>Selisih<strong>{session.difference == null ? '-' : money(session.difference)}</strong></span></div><details><summary>{session.entries.length} peserta · Lihat rincian</summary><div className="collection-entry-details">{session.entries.map((entry) => <div key={entry.id}><span>{entry.participantName}</span><strong>{money(entry.amount)}</strong></div>)}</div></details>{!isManager && session.status !== 'VERIFIED' && <div className="collection-verify-row"><input type="number" min="0" placeholder="Cash diterima" value={actualCash[session.id] || ''} onChange={(event) => setActualCash((current) => ({ ...current, [session.id]: event.target.value }))} /><button type="button" className="btn btn-primary" onClick={() => verify(session)}>Konfirmasi diterima</button></div>}</article>)}</div></section></div>}
      </AdminShell>
  );
}
