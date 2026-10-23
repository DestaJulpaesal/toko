import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, UserRoundCheck, Users } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import ModalForm from '../components/ModalForm';
import { apiFetch, monitorSessionExpiry } from '../services/api';
import { confirmAction } from '../utils/confirmService';
import { clearStaffCaches } from '../utils/catalogStorage';

const emptyAccountForm = { name: '', email: '', phone: '', role: 'CASHIER', regionId: '', password: '' };
const roleLabels = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  CASHIER: 'Kasir',
  PARCEL_MANAGER: 'Manager Parsel',
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('glosir_user') || 'null');
  } catch {
    return null;
  }
}

export default function AccountManagementPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isOwner = currentUser?.role === 'OWNER';
  const [accounts, setAccounts] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', passwordConfirmation: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionAction, setSessionAction] = useState('');

  const loadAccounts = async () => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [accountResponse, regionResponse] = await Promise.all([
        apiFetch('/accounts'),
        apiFetch('/parcel-regions'),
      ]);
      const [accountData, regionData] = await Promise.all([accountResponse.json(), regionResponse.json()]);
      if (!accountResponse.ok || !accountData.success) throw new Error(accountData.message || 'Data akun gagal dimuat.');
      if (!regionResponse.ok || !regionData.success) throw new Error(regionData.message || 'Data wilayah gagal dimuat.');
      setAccounts(accountData.accounts || []);
      setRegions(regionData.regions || []);
    } catch (error) {
      setNotice(error.message || 'Data akun gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) => [account.name, account.email, account.phone, roleLabels[account.role], account.regionName]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [accounts, search]);

  const openInviteForm = () => {
    setEditingAccount(null);
    setAccountForm(emptyAccountForm);
    setNotice('');
    setAccountModalOpen(true);
  };

  const openEditForm = (account) => {
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      email: account.email,
      phone: account.phone || '',
      role: account.role,
      regionId: account.regionId || '',
      password: '',
    });
    setNotice('');
    setAccountModalOpen(true);
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice('');
    try {
      const payload = {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        phone: accountForm.phone.trim(),
        role: accountForm.role,
        ...(accountForm.role === 'PARCEL_MANAGER' ? { regionId: accountForm.regionId } : {}),
      };
      if (editingAccount) {
        payload.regionId = accountForm.role === 'PARCEL_MANAGER' ? accountForm.regionId : null;
        payload.isActive = editingAccount.isActive;
        payload.password = accountForm.password;
      }
      const response = await apiFetch(
        editingAccount ? `/accounts/${editingAccount.id}` : '/auth/invite',
        {
          method: editingAccount ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Akun gagal disimpan.');
      setAccountModalOpen(false);
      setNotice(data.message || (editingAccount ? 'Akun berhasil diperbarui.' : 'Undangan akun berhasil dikirim.'));
      await loadAccounts();
    } catch (error) {
      setNotice(error.message || 'Akun gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAccountStatus = async (account) => {
    const confirmation = account.isActive
      ? `Hapus akses ${account.name}? Akun akan dinonaktifkan, tetapi data dan riwayatnya tetap tersimpan.`
      : `Aktifkan kembali akun ${account.name}?`;
    if (!await confirmAction(confirmation)) return;
    try {
      const response = await apiFetch(`/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || `Akun gagal ${account.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      setNotice(account.isActive
        ? `Akses akun ${account.name} dihapus dengan menonaktifkan akun. Riwayat tetap tersimpan.`
        : `Akun ${account.name} berhasil diaktifkan kembali.`);
      await loadAccounts();
    } catch (error) {
      setNotice(error.message || 'Status akun gagal diperbarui.');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.passwordConfirmation) {
      setNotice('Password baru dan konfirmasi password harus sama.');
      return;
    }
    setPasswordSaving(true);
    setNotice('');
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Password gagal diganti.');
      if (!data.token) throw new Error('Password berubah, tetapi sesi baru tidak diterima. Silakan login kembali.');
      localStorage.setItem('glosir_token', data.token);
      monitorSessionExpiry();
      setPasswordForm({ newPassword: '', passwordConfirmation: '' });
      setNotice('Password berhasil diganti.');
    } catch (error) {
      setNotice(error.message || 'Password gagal diganti.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const logoutOtherDevices = async () => {
    if (!await confirmAction('Keluarkan semua perangkat lain? Perangkat ini tetap masuk.')) return;
    setSessionAction('others');
    setNotice('');
    try {
      const response = await apiFetch('/auth/logout-others', { method: 'POST', silentNotify: true });
      const data = await response.json();
      if (!response.ok || !data.success || !data.token) throw new Error(data.message || 'Sesi perangkat lain gagal dikeluarkan.');
      localStorage.setItem('glosir_token', data.token);
      monitorSessionExpiry();
      setNotice(data.message || 'Sesi perangkat lain berhasil dikeluarkan.');
    } catch (error) {
      setNotice(error.message || 'Sesi perangkat lain gagal dikeluarkan.');
    } finally {
      setSessionAction('');
    }
  };

  const logoutAllDevices = async () => {
    if (!await confirmAction('Keluarkan semua perangkat termasuk perangkat ini? Anda harus login kembali.')) return;
    setSessionAction('all');
    setNotice('');
    try {
      const response = await apiFetch('/auth/logout-all', { method: 'POST', silentNotify: true });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Sesi gagal dikeluarkan.');
      localStorage.removeItem('glosir_token');
      localStorage.removeItem('glosir_user');
      clearStaffCaches();
      navigate('/login', { replace: true });
    } catch (error) {
      setNotice(error.message || 'Sesi gagal dikeluarkan.');
      setSessionAction('');
    }
  };

  return (
    <AdminShell active="Akun & Akses" mainClassName="account-management-page">
      <header className="admin-header account-page-header">
        <div>
          <p className="eyebrow light">PENGATURAN KEAMANAN</p>
          <h1>{isOwner ? 'Akun & Akses' : 'Keamanan Akun'}</h1>
          <p className="admin-subtitle">{isOwner ? 'Kelola akun Owner, Admin, Kasir, dan Manager Parsel dari satu tempat.' : 'Ubah password dan kelola sesi login akun Anda.'}</p>
        </div>
        {isOwner && <button type="button" className="btn btn-secondary" onClick={loadAccounts} disabled={loading}><RefreshCw size={15} /> {loading ? 'Memuat...' : 'Muat ulang'}</button>}
      </header>

      {notice && <div className="crud-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}

      {isOwner && (
        <section className="account-summary-grid" aria-label="Ringkasan akun">
          <div className="dashboard-stat-card"><span className="account-stat-icon"><Users size={16} /></span><span>Total akun</span><strong>{accounts.length}</strong><small>Termasuk akun nonaktif</small></div>
          <div className="dashboard-stat-card"><span className="account-stat-icon is-green"><ShieldCheck size={16} /></span><span>Akun aktif</span><strong>{accounts.filter((account) => account.isActive).length}</strong><small>Dapat mengakses aplikasi</small></div>
          <div className="dashboard-stat-card"><span className="account-stat-icon is-blue"><KeyRound size={16} /></span><span>Kasir</span><strong>{accounts.filter((account) => account.role === 'CASHIER').length}</strong><small>Akun operasional kasir</small></div>
        </section>
      )}

      {!isOwner && <div className="account-access-notice" role="note"><ShieldCheck size={18} /> Pengelolaan akun karyawan hanya tersedia untuk Owner.</div>}

      <div className={`account-workspace-grid${isOwner ? '' : ' is-security-only'}`}>
        {isOwner && (
          <section className="dashboard-panel account-list-panel">
            <div className="dashboard-panel-heading">
              <div><span className="panel-kicker">Akun terdaftar</span><h2>Semua akun</h2></div>
              <button type="button" className="btn btn-primary" onClick={openInviteForm}><Plus size={16} /> Undang akun</button>
            </div>
            <div className="account-list-toolbar">
              <p>Hapus akses akun dengan ikon tong sampah. Akun dinonaktifkan dan riwayatnya tetap tersimpan.</p>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, peran..." aria-label="Cari akun" />
            </div>
            <div className="account-table-wrap">
              <table className="account-table">
                <thead><tr><th>Nama / Email</th><th>Peran</th><th>Wilayah</th><th>Status</th><th>Email</th><th>Aksi</th></tr></thead>
                <tbody>
                  {filteredAccounts.map((account) => {
                    const protectedAccount = account.role === 'OWNER';
                    return <tr key={account.id}>
                      <td data-label="Nama / Email"><strong>{account.name}</strong><small>{account.email}{account.phone ? ` · ${account.phone}` : ''}</small></td>
                      <td data-label="Peran"><span className={`account-role-badge role-${account.role.toLowerCase()}`}>{roleLabels[account.role] || account.role}</span></td>
                      <td data-label="Wilayah">{account.regionName || '—'}</td>
                      <td data-label="Status"><span className={`account-status ${account.isActive ? 'is-active' : 'is-inactive'}`}>{account.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td data-label="Email">{account.emailVerifiedAt ? 'Terverifikasi' : 'Belum verifikasi'}</td>
                      <td data-label="Aksi" className="account-row-actions">
                        {protectedAccount
                          ? <span className="account-protected-label"><ShieldCheck size={14} /> Dilindungi</span>
                          : <>
                            <button type="button" className="icon-action" onClick={() => openEditForm(account)} aria-label={`Edit akun ${account.name}`} title="Edit akun"><Pencil size={14} /></button>
                            <button type="button" className={`icon-action ${account.isActive ? 'icon-action-danger' : ''}`} onClick={() => toggleAccountStatus(account)} aria-label={account.isActive ? `Hapus akses akun ${account.name} (nonaktifkan)` : `Aktifkan kembali akun ${account.name}`} title={account.isActive ? 'Hapus akses (nonaktifkan)' : 'Aktifkan kembali'}>{account.isActive ? <Trash2 size={14} /> : <UserRoundCheck size={14} />}</button>
                          </>}
                      </td>
                    </tr>;
                  })}
                  {!loading && !filteredAccounts.length && <tr><td colSpan="6" className="account-empty-state">Tidak ada akun yang cocok dengan pencarian.</td></tr>}
                  {loading && <tr><td colSpan="6" className="account-empty-state">Memuat data akun...</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="crud-form-panel account-security-panel">
          <div className="panel-heading"><div><span className="panel-kicker">KEAMANAN AKUN</span><h2>Ganti password</h2><p>Password baru berlaku untuk akun {currentUser?.email || 'Anda'}.</p></div></div>
          <form onSubmit={changePassword}>
            <div className="form-two-columns">
              <label>Password baru<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} placeholder="Minimal 8 karakter" /></label>
              <label>Ulangi password baru<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.passwordConfirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, passwordConfirmation: event.target.value }))} placeholder="Ketik ulang password baru" /></label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Mengganti password...' : 'Simpan password baru'}</button>
          </form>
          <hr />
          <h3>Kelola sesi login</h3>
          <p>Keluarkan perangkat yang tidak lagi digunakan. Mengeluarkan semua perangkat akan meminta Anda login kembali.</p>
          <div className="form-two-columns">
            <button className="btn btn-secondary" type="button" disabled={Boolean(sessionAction)} onClick={logoutOtherDevices}>{sessionAction === 'others' ? 'Mengeluarkan perangkat...' : 'Keluarkan perangkat lain'}</button>
            <button className="btn btn-secondary" type="button" disabled={Boolean(sessionAction)} onClick={logoutAllDevices}>{sessionAction === 'all' ? 'Mengeluarkan semua...' : 'Keluarkan semua perangkat'}</button>
          </div>
        </section>
      </div>

      <ModalForm
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Edit akun' : 'Undang akun baru'}
        subtitle={editingAccount ? 'Perbarui identitas, peran, wilayah, atau password akun.' : 'Karyawan akan menerima email untuk membuat password sendiri.'}
        kicker="Akun Glosir"
        maxWidth="680px"
      >
        <form className="account-edit-form" onSubmit={submitAccount}>
          <div className="form-two-columns">
            <label>Nama lengkap<input required maxLength={100} autoComplete="name" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Email<input required type="email" autoComplete="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} /></label>
          </div>
          <div className="form-two-columns">
            <label>Nomor telepon<input type="tel" autoComplete="tel" value={accountForm.phone} onChange={(event) => setAccountForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Opsional" /></label>
            <label>Peran<select value={accountForm.role} onChange={(event) => setAccountForm((current) => ({ ...current, role: event.target.value, regionId: event.target.value === 'PARCEL_MANAGER' ? current.regionId : '' }))}><option value="CASHIER">Kasir</option><option value="ADMIN">Admin</option><option value="PARCEL_MANAGER">Manager Parsel</option></select></label>
          </div>
          {accountForm.role === 'PARCEL_MANAGER' && <>
            <label>Wilayah penugasan<select required value={accountForm.regionId} onChange={(event) => setAccountForm((current) => ({ ...current, regionId: event.target.value }))}><option value="">Pilih wilayah</option>{regions.filter((region) => region.isActive && (!region.managerId || region.managerId === editingAccount?.id)).map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}{editingAccount?.regionId && !regions.some((region) => region.id === editingAccount.regionId) && <option value={editingAccount.regionId}>{editingAccount.regionName || 'Wilayah terhubung'} · tidak aktif</option>}</select></label>
            {editingAccount?.regionId && editingAccount.regionIsActive === false && <small className="account-region-warning">Wilayah akun ini sedang nonaktif. Pilih wilayah aktif untuk memindahkan manager.</small>}
          </>}
          {editingAccount && <label>Password baru <span className="account-optional-label">(opsional)</span><input type="password" autoComplete="new-password" minLength={8} value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} placeholder="Kosongkan jika tidak diubah" /><small>Jika password diubah, semua sesi akun ini akan dikeluarkan.</small></label>}
          <div className="account-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setAccountModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving || (accountForm.role === 'PARCEL_MANAGER' && !accountForm.regionId)}>{saving ? 'Menyimpan...' : editingAccount ? 'Simpan perubahan' : <><UserPlus size={15} /> Kirim undangan</>}</button>
          </div>
        </form>
      </ModalForm>
    </AdminShell>
  );
}
