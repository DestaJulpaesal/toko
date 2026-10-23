import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Eye, Plus, Search, Users } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import ModalForm from '../components/ModalForm';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const localDateValue = () => {
  const now = new Date();
  const localOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - localOffset).toISOString().slice(0, 10);
};
const dateLabel = (value) => new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const differenceLabel = (value) => {
  if (value == null) return '-';
  const difference = Number(value);
  if (!difference) return 'Sesuai';
  return `${difference > 0 ? 'Lebih' : 'Kurang'} ${money(Math.abs(difference))}`;
};

export default function ParcelCollectionPage() {
  const [participants, setParticipants] = useState([]);
  const [regions, setRegions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [collectionDate, setCollectionDate] = useState(localDateValue);
  const [amounts, setAmounts] = useState({});
  const [participantSearch, setParticipantSearch] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [verificationSession, setVerificationSession] = useState(null);
  const [verificationCash, setVerificationCash] = useState('');
  const [detailsSession, setDetailsSession] = useState(null);
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
  const pendingSessions = sessions.filter((session) => session.status !== 'VERIFIED');
  const verifiedSessions = sessions.filter((session) => session.status === 'VERIFIED');
  const totalCollected = sessions.reduce((sum, session) => sum + Number(session.expectedAmount || 0), 0);
  const regionName = regions.find((region) => region.id === regionId)?.name || sessions.find((session) => session.regionId === regionId)?.regionName || (isManager ? 'Wilayah saya' : 'Pilih wilayah');
  const visibleSessions = sessions.filter((session) => {
    const matchesRegion = regionFilter === 'all' || session.regionId === regionFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'pending' ? session.status !== 'VERIFIED' : session.status === 'VERIFIED');
    const term = sessionSearch.trim().toLowerCase();
    const matchesSearch = !term || `${session.regionName || ''} ${session.managerName || ''} ${dateLabel(session.collectionDate)}`.toLowerCase().includes(term);
    return matchesRegion && matchesStatus && matchesSearch;
  });

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
      setAmounts({});
      setNote('');
      setParticipantSearch('');
      setFormOpen(false);
      await load();
    } catch (error) { setNotice(error.message || 'Rekap gagal disimpan.'); }
    finally { setSaving(false); }
  };

  const openVerification = (session) => {
    setVerificationSession(session);
    setVerificationCash(String(session.expectedAmount ?? ''));
  };

  const verify = async (event) => {
    event.preventDefault();
    if (!verificationSession || verificationCash === '') return;
    const value = Number(verificationCash);
    if (!Number.isFinite(value) || value < 0) {
      setNotice('Masukkan nominal uang tunai yang valid.');
      return;
    }
    setVerifyingId(verificationSession.id);
    try {
      const response = await apiFetch(`/parcel-collections/${verificationSession.id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actualCash: value }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Verifikasi gagal.');
      setNotice('Serah terima cash berhasil dicatat.');
      setVerificationSession(null);
      await load();
    } catch (error) { setNotice(error.message || 'Verifikasi gagal.'); }
    finally { setVerifyingId(''); }
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Penagihan Wilayah" />
      <main className="admin-main collection-page">
        <header className="admin-header">
          <div><p className="eyebrow light">Buku setoran digital</p><h1>Penagihan Wilayah</h1><p className="admin-subtitle">Pantau setoran setiap wilayah dan cocokkan uang tunai yang diterima.</p></div>
          <button type="button" className="btn btn-primary collection-add-button" onClick={() => setFormOpen(true)} disabled={loading || (!isManager && !regions.length)}><Plus size={17} /> Catat setoran</button>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}

        <section className="collection-summary" aria-label="Ringkasan rekap penagihan">
          <article className="collection-summary-card">
            <span className="collection-summary-icon is-green"><CircleDollarSign size={18} /></span>
            <span><small>Total nominal rekap</small><strong>{money(totalCollected)}</strong><em>{sessions.length} rekap tersimpan</em></span>
          </article>
          <article className="collection-summary-card">
            <span className="collection-summary-icon is-amber"><Clock3 size={18} /></span>
            <span><small>Menunggu konfirmasi</small><strong>{pendingSessions.length} rekap</strong><em>Perlu dicocokkan dengan uang tunai</em></span>
          </article>
          <article className="collection-summary-card">
            <span className="collection-summary-icon is-blue"><CheckCircle2 size={18} /></span>
            <span><small>Sudah diverifikasi</small><strong>{verifiedSessions.length} rekap</strong><em>Serah terima sudah dicatat</em></span>
          </article>
        </section>

        <section className="crud-table-panel collection-table-panel">
          <div className="collection-table-heading">
            <div><span className="panel-kicker">Pemeriksaan & serah terima</span><h2>Rekap penagihan</h2><p className="collection-panel-hint">Periksa setoran dari manager, lalu catat uang tunai yang diterima.</p></div>
            <span className="collection-count">{visibleSessions.length} dari {sessions.length} rekap</span>
          </div>
          <div className="collection-toolbar">
            <label className="collection-toolbar-search"><Search size={16} /><input type="search" value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder="Cari wilayah atau manager" aria-label="Cari wilayah atau manager" /></label>
            {!isManager && <select aria-label="Filter wilayah" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">Semua wilayah</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select>}
            <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Semua status</option><option value="pending">Perlu verifikasi</option><option value="verified">Sudah diterima</option></select>
          </div>

          <div className="product-table-wrap collection-table-wrap">
            <table className="product-table collection-table">
              <thead><tr><th>Wilayah</th><th>Tanggal & manager</th><th>Peserta</th><th>Total disetor</th><th>Uang diterima</th><th>Selisih kas</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {visibleSessions.map((session) => <tr key={session.id}>
                  <td><strong>{session.regionName}</strong><small>Rekap penagihan</small></td>
                  <td><strong>{dateLabel(session.collectionDate)}</strong><small>Manager {session.managerName || '-'}</small></td>
                  <td>{(session.entries || []).length} peserta</td>
                  <td><strong>{money(session.expectedAmount)}</strong></td>
                  <td><strong>{session.actualCash == null ? 'Belum diterima' : money(session.actualCash)}</strong></td>
                  <td><strong className={`collection-difference${session.difference == null ? '' : Number(session.difference) < 0 ? ' is-negative' : Number(session.difference) > 0 ? ' is-positive' : ' is-even'}`}>{differenceLabel(session.difference)}</strong></td>
                  <td><span className={`status-chip ${session.status === 'VERIFIED' ? 'good' : 'warning'}`}>{session.status === 'VERIFIED' ? 'Terverifikasi' : 'Menunggu konfirmasi'}</span></td>
                  <td><div className="collection-row-actions"><button type="button" className="collection-detail-button" onClick={() => setDetailsSession(session)}><Eye size={14} /> Rincian</button>{!isManager && session.status !== 'VERIFIED' && <button type="button" className="collection-verify-button" onClick={() => openVerification(session)}><CheckCircle2 size={14} /> Konfirmasi</button>}</div></td>
                </tr>)}
                {!loading && !visibleSessions.length && <tr><td colSpan="8"><div className="collection-table-empty"><CheckCircle2 size={24} /><strong>{sessions.length ? 'Rekap tidak ditemukan' : 'Belum ada rekap penagihan'}</strong><span>{sessions.length ? 'Coba ubah kata kunci atau filter yang dipilih.' : 'Rekap akan tampil di sini setelah manager menyimpan setoran.'}</span></div></td></tr>}
                {loading && <tr><td colSpan="8"><div className="collection-table-empty" role="status">Memuat rekap penagihan...</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <ModalForm isOpen={formOpen} onClose={() => setFormOpen(false)} title="Catat setoran" subtitle="Isi nominal yang dibayarkan setiap peserta di wilayah ini." kicker="Kunjungan penagihan" maxWidth="680px" cardClassName="collection-modal">
        <form className="collection-modal-form" onSubmit={submit}>
          {!isManager && <label>Wilayah<select required value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="">Pilih wilayah</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}</select></label>}
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
      </ModalForm>

      <ModalForm isOpen={Boolean(verificationSession)} onClose={() => setVerificationSession(null)} title="Konfirmasi uang tunai" subtitle="Cocokkan uang yang diterima dengan rekap setoran." kicker={verificationSession?.regionName || 'Serah terima'} maxWidth="480px" cardClassName="collection-modal">
        {verificationSession && <form className="collection-modal-form" onSubmit={verify}>
          <div className="collection-verify-summary"><span>Total setoran<strong>{money(verificationSession.expectedAmount)}</strong></span><span>{dateLabel(verificationSession.collectionDate)} · {verificationSession.managerName || 'Manager'}</span></div>
          <label>Uang tunai diterima<CurrencyInput required min="0" value={verificationCash} onValueChange={setVerificationCash} placeholder="Masukkan nominal" /></label>
          <div className="collection-modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setVerificationSession(null)}>Batal</button><button type="submit" className="btn btn-primary" disabled={verifyingId === verificationSession.id}>{verifyingId === verificationSession.id ? 'Menyimpan...' : 'Konfirmasi cash'}</button></div>
        </form>}
      </ModalForm>

      <ModalForm isOpen={Boolean(detailsSession)} onClose={() => setDetailsSession(null)} title="Rincian setoran" subtitle={detailsSession ? `${detailsSession.regionName} · ${dateLabel(detailsSession.collectionDate)}` : ''} kicker="Detail rekap" maxWidth="560px" cardClassName="collection-modal">
        {detailsSession && <div className="collection-details-modal">
          <div className="collection-detail-summary">
            <div><span>Total disetor</span><strong>{money(detailsSession.expectedAmount)}</strong></div>
            <div><span>Manager</span><strong>{detailsSession.managerName || '-'}</strong></div>
            {detailsSession.status === 'VERIFIED' && <div><span>Uang diterima</span><strong>{money(detailsSession.actualCash)}</strong></div>}
          </div>
          {detailsSession.note && <div className="collection-details-note"><strong>Catatan manager</strong><p>{detailsSession.note}</p></div>}
          <div className="collection-details-heading"><div><strong>Daftar setoran peserta</strong><span>Nominal yang dibayarkan setiap peserta</span></div><span>{(detailsSession.entries || []).length} peserta</span></div>
          <div className="collection-details-list" aria-label="Daftar setoran peserta">
            {(detailsSession.entries || []).map((entry) => <div key={entry.id}><span className="collection-participant-name"><i>{(entry.participantName || '?').trim().charAt(0).toUpperCase()}</i>{entry.participantName}</span><strong>{money(entry.amount)}</strong></div>)}
            {!(detailsSession.entries || []).length && <p className="collection-details-empty">Tidak ada rincian peserta pada rekap ini.</p>}
          </div>
        </div>}
      </ModalForm>
    </div>
  );
}
