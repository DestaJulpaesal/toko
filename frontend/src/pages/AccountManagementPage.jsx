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
const commonPasswords = new Set(['password', 'password123', '12345678', 'qwerty123', 'qwertyui', 'admin123', 'glosir123']);

function validateAccountForm(form, editing) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();

  if (!name) errors.name = 'Nama lengkap wajib diisi.';
  else if (name.length > 100) errors.name = 'Nama lengkap maksimal 100 karakter.';

  if (!email) errors.email = 'Alamat email wajib diisi.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Masukkan alamat email dengan format yang benar.';

  if (editing && form.password && form.password.length < 8) {
    errors.password = 'Kata sandi baru minimal 8 karakter.';
  } else if (editing && commonPasswords.has(form.password.trim().toLowerCase())) {
    errors.password = 'Kata sandi terlalu mudah ditebak. Gunakan kata sandi yang lebih kuat.';
  }

  if (form.role === 'PARCEL_MANAGER' && !form.regionId) {
    errors.regionId = 'Pilih wilayah tugas untuk Manager Parsel.';
  }

  return errors;
}

function validatePasswordForm(form) {
  const errors = {};
  if (!form.newPassword) errors.newPassword = 'Kata sandi baru wajib diisi.';
  else if (form.newPassword.length < 8) errors.newPassword = 'Kata sandi baru minimal 8 karakter.';
  else if (commonPasswords.has(form.newPassword.trim().toLowerCase())) {
    errors.newPassword = 'Kata sandi terlalu mudah ditebak. Gunakan kata sandi yang lebih kuat.';
  }

  if (!form.passwordConfirmation) errors.passwordConfirmation = 'Ulangi kata sandi baru.';
  else if (form.newPassword !== form.passwordConfirmation) errors.passwordConfirmation = 'Kata sandi yang diulang belum sama.';
  return errors;
}

function translateAccountValidationIssues(issues = []) {
  const errors = {};
  issues.forEach(({ field }) => {
    if (field === 'name') errors.name = 'Periksa kembali nama lengkap (maksimal 100 karakter).';
    if (field === 'email') errors.email = 'Masukkan alamat email dengan format yang benar.';
    if (field === 'regionId') errors.regionId = 'Pilih wilayah tugas yang masih tersedia.';
    if (field === 'password') errors.password = 'Kata sandi baru minimal 8 karakter dan tidak mudah ditebak.';
    if (field === 'newPassword') errors.newPassword = 'Kata sandi baru minimal 8 karakter dan tidak mudah ditebak.';
    if (field === 'passwordConfirmation') errors.passwordConfirmation = 'Pastikan kata sandi yang diulang sudah sama dan minimal 8 karakter.';
  });
  return errors;
}

function getIndonesianError(error, fallback) {
  if (error instanceof TypeError) return 'Koneksi ke server bermasalah. Periksa internet lalu coba lagi.';
  if (error instanceof SyntaxError) return 'Respons server tidak dapat dibaca. Coba muat ulang halaman.';
  return error.message || fallback;
}

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
  const [accountFieldErrors, setAccountFieldErrors] = useState({});
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', passwordConfirmation: '' });
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});
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
      setNotice(getIndonesianError(error, 'Data akun belum berhasil dimuat.'));
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

  const updateAccountField = (field, value) => {
    setAccountForm((current) => ({ ...current, [field]: value }));
    setAccountFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === 'role' && value !== 'PARCEL_MANAGER') delete next.regionId;
      return next;
    });
  };

  const updatePasswordField = (field, value) => {
    const updated = { ...passwordForm, [field]: value };
    setPasswordForm(updated);
    setPasswordFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === 'newPassword' && next.passwordConfirmation) {
        if (updated.newPassword !== updated.passwordConfirmation) {
          next.passwordConfirmation = 'Kata sandi yang diulang belum sama.';
        } else {
          delete next.passwordConfirmation;
        }
      }
      return next;
    });
  };

  const openInviteForm = () => {
    setEditingAccount(null);
    setAccountForm(emptyAccountForm);
    setAccountFieldErrors({});
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
    setAccountFieldErrors({});
    setNotice('');
    setAccountModalOpen(true);
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    if (saving) return;
    const errors = validateAccountForm(accountForm, Boolean(editingAccount));
    setAccountFieldErrors(errors);
    if (Object.keys(errors).length) {
      setNotice('');
      document.getElementById(Object.keys(errors)[0] === 'regionId' ? 'account-region' : `account-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
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
      if (!response.ok || !data.success) {
        const serverErrors = translateAccountValidationIssues(data.errors);
        if (Object.keys(serverErrors).length) {
          setAccountFieldErrors(serverErrors);
          document.getElementById(Object.keys(serverErrors)[0] === 'regionId' ? 'account-region' : `account-${Object.keys(serverErrors)[0]}`)?.focus();
          return;
        }
        throw new Error(data.message || 'Akun belum berhasil disimpan. Silakan coba lagi.');
      }
      setAccountModalOpen(false);
      setAccountFieldErrors({});
      setNotice(data.message || (editingAccount ? 'Akun berhasil diperbarui.' : 'Undangan akun berhasil dikirim.'));
      await loadAccounts();
    } catch (error) {
      setNotice(getIndonesianError(error, 'Akun belum berhasil disimpan. Silakan coba lagi.'));
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
      setNotice(getIndonesianError(error, 'Status akun belum berhasil diperbarui.'));
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const errors = validatePasswordForm(passwordForm);
    setPasswordFieldErrors(errors);
    if (Object.keys(errors).length) {
      setNotice('');
      document.getElementById(`account-${Object.keys(errors)[0]}`)?.focus();
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
      if (!response.ok || !data.success) {
        const serverErrors = translateAccountValidationIssues(data.errors);
        if (Object.keys(serverErrors).length) {
          setPasswordFieldErrors(serverErrors);
          document.getElementById(`account-${Object.keys(serverErrors)[0]}`)?.focus();
          return;
        }
        throw new Error(data.message || 'Kata sandi belum berhasil diganti. Silakan coba lagi.');
      }
      if (!data.token) throw new Error('Kata sandi berubah, tetapi sesi baru tidak diterima. Silakan masuk kembali.');
      localStorage.setItem('glosir_token', data.token);
      monitorSessionExpiry();
      setPasswordForm({ newPassword: '', passwordConfirmation: '' });
      setPasswordFieldErrors({});
      setNotice('Kata sandi berhasil diganti.');
    } catch (error) {
      setNotice(getIndonesianError(error, 'Kata sandi belum berhasil diganti. Silakan coba lagi.'));
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
      setNotice(getIndonesianError(error, 'Sesi perangkat lain gagal dikeluarkan.'));
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
      setNotice(getIndonesianError(error, 'Sesi gagal dikeluarkan.'));
      setSessionAction('');
    }
  };

  return (
    <AdminShell active="Akun & Akses" mainClassName="account-management-page">
      <header className="admin-header account-page-header">
        <div>
          <p className="eyebrow light">{isOwner ? 'PENGELOLAAN TOKO' : 'PENGATURAN KEAMANAN'}</p>
          <h1>{isOwner ? 'Akun & Akses' : 'Keamanan Akun'}</h1>
          <p className="admin-subtitle">{isOwner ? 'Kelola akun Owner, Admin, Kasir, dan Manager Parsel dari satu tempat.' : 'Ubah kata sandi dan kelola sesi masuk akun Anda.'}</p>
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
              <div><span className="panel-kicker">AKUN TERDAFTAR</span><h2>Semua akun</h2><p>Kelola akses dan peran tim toko.</p></div>
              <button type="button" className="btn btn-primary" onClick={openInviteForm}><Plus size={16} /> Undang akun</button>
            </div>
            <div className="account-list-toolbar">
              <p>{loading ? 'Memuat daftar akun...' : `Menampilkan ${filteredAccounts.length} dari ${accounts.length} akun. Menonaktifkan akun akan mempertahankan riwayatnya.`}</p>
              <label className="account-search-field">
                <span className="sr-only">Cari akun</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, peran..." aria-label="Cari akun" />
              </label>
            </div>
            <div className="account-table-wrap">
              <table className="account-table">
                <thead><tr><th scope="col">Nama akun</th><th scope="col">Peran</th><th scope="col">Wilayah tugas</th><th scope="col">Status akun</th><th scope="col">Verifikasi email</th><th scope="col">Tindakan</th></tr></thead>
                <tbody>
                  {filteredAccounts.map((account) => {
                    const protectedAccount = account.role === 'OWNER';
                    return <tr key={account.id}>
                      <td data-label="Nama akun"><strong>{account.name}</strong><small>{account.email}</small>{account.phone && <small className="account-phone">{account.phone}</small>}</td>
                      <td data-label="Peran"><span className={`account-role-badge role-${account.role.toLowerCase()}`}>{roleLabels[account.role] || account.role}</span></td>
                      <td data-label="Wilayah tugas">{account.regionName || <span className="account-table-muted">Tidak ditetapkan</span>}</td>
                      <td data-label="Status akun"><span className={`account-status ${account.isActive ? 'is-active' : 'is-inactive'}`}><i />{account.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td data-label="Verifikasi email"><span className={`account-verification ${account.emailVerifiedAt ? 'is-verified' : 'is-pending'}`}>{account.emailVerifiedAt ? 'Terverifikasi' : 'Belum diverifikasi'}</span></td>
                      <td data-label="Aksi" className="account-row-actions">
                        {protectedAccount
                          ? <span className="account-protected-label"><ShieldCheck size={14} /> Akun utama</span>
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
          <div className="account-security-heading">
            <span className="account-security-icon"><ShieldCheck size={19} /></span>
            <div><span className="panel-kicker">KEAMANAN AKUN</span><h2>Amankan akunmu</h2><p>Atur kata sandi dan perangkat yang sedang masuk.</p></div>
          </div>
          <div className="account-security-grid">
            <section className="account-security-section">
              <div className="account-security-section-heading"><KeyRound size={17} /><div><h3>Ganti kata sandi</h3><p>Berlaku untuk akun <strong>{currentUser?.email || 'Anda'}</strong>.</p></div></div>
              <form onSubmit={changePassword} noValidate>
                <div className="form-two-columns">
                  <label htmlFor="account-newPassword">Kata sandi baru
                    <input id="account-newPassword" type="password" autoComplete="new-password" minLength={8} required value={passwordForm.newPassword} onChange={(event) => updatePasswordField('newPassword', event.target.value)} placeholder="Minimal 8 karakter" aria-invalid={Boolean(passwordFieldErrors.newPassword)} aria-describedby={passwordFieldErrors.newPassword ? 'account-newPassword-error' : undefined} />
                    {passwordFieldErrors.newPassword && <small className="account-field-error" id="account-newPassword-error" role="alert">{passwordFieldErrors.newPassword}</small>}
                  </label>
                  <label htmlFor="account-passwordConfirmation">Ulangi kata sandi
                    <input id="account-passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required value={passwordForm.passwordConfirmation} onChange={(event) => updatePasswordField('passwordConfirmation', event.target.value)} placeholder="Ketik ulang kata sandi" aria-invalid={Boolean(passwordFieldErrors.passwordConfirmation)} aria-describedby={passwordFieldErrors.passwordConfirmation ? 'account-passwordConfirmation-error' : undefined} />
                    {passwordFieldErrors.passwordConfirmation && <small className="account-field-error" id="account-passwordConfirmation-error" role="alert">{passwordFieldErrors.passwordConfirmation}</small>}
                  </label>
                </div>
                <button className="btn btn-primary" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Mengganti kata sandi...' : 'Simpan kata sandi'}</button>
              </form>
            </section>
            <section className="account-security-section">
              <div className="account-security-section-heading"><KeyRound size={17} /><div><h3>Kelola sesi login</h3><p>Keluarkan perangkat yang tidak lagi digunakan. Perangkat akan diminta masuk kembali.</p></div></div>
              <div className="account-session-actions">
                <button className="btn btn-secondary" type="button" disabled={Boolean(sessionAction)} onClick={logoutOtherDevices}>{sessionAction === 'others' ? 'Mengeluarkan perangkat...' : 'Keluarkan perangkat lain'}</button>
                <button className="btn btn-secondary" type="button" disabled={Boolean(sessionAction)} onClick={logoutAllDevices}>{sessionAction === 'all' ? 'Mengeluarkan semua...' : 'Keluarkan semua perangkat'}</button>
              </div>
            </section>
          </div>
        </section>
      </div>

      <ModalForm
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Edit akun' : 'Undang akun baru'}
        subtitle={editingAccount ? 'Perbarui identitas, peran, wilayah, atau kata sandi akun.' : 'Karyawan akan menerima email untuk membuat kata sandi sendiri.'}
        kicker="Akun Glosir"
        maxWidth="680px"
      >
        <form className="account-edit-form" onSubmit={submitAccount} noValidate>
          <div className="form-two-columns">
            <label htmlFor="account-name">Nama lengkap
              <input id="account-name" required maxLength={100} autoComplete="name" value={accountForm.name} onChange={(event) => updateAccountField('name', event.target.value)} aria-invalid={Boolean(accountFieldErrors.name)} aria-describedby={accountFieldErrors.name ? 'account-name-error' : undefined} />
              {accountFieldErrors.name && <small className="account-field-error" id="account-name-error" role="alert">{accountFieldErrors.name}</small>}
            </label>
            <label htmlFor="account-email">Alamat email
              <input id="account-email" required type="email" autoComplete="email" value={accountForm.email} onChange={(event) => updateAccountField('email', event.target.value)} aria-invalid={Boolean(accountFieldErrors.email)} aria-describedby={accountFieldErrors.email ? 'account-email-error' : undefined} />
              {accountFieldErrors.email && <small className="account-field-error" id="account-email-error" role="alert">{accountFieldErrors.email}</small>}
            </label>
          </div>
          <div className="form-two-columns">
            <label htmlFor="account-phone">Nomor telepon <span className="account-optional-label">(opsional)</span><input id="account-phone" type="tel" autoComplete="tel" value={accountForm.phone} onChange={(event) => updateAccountField('phone', event.target.value)} placeholder="08xx xxxx xxxx" /></label>
            <label htmlFor="account-role">Peran<select id="account-role" value={accountForm.role} onChange={(event) => updateAccountField('role', event.target.value)}><option value="CASHIER">Kasir</option><option value="ADMIN">Admin</option><option value="PARCEL_MANAGER">Manager Parsel</option></select></label>
          </div>
          {accountForm.role === 'PARCEL_MANAGER' && <>
            <label htmlFor="account-region">Wilayah tugas
              <select id="account-region" required value={accountForm.regionId} onChange={(event) => updateAccountField('regionId', event.target.value)} aria-invalid={Boolean(accountFieldErrors.regionId)} aria-describedby={accountFieldErrors.regionId ? 'account-region-error' : undefined}><option value="">Pilih wilayah tugas</option>{regions.filter((region) => region.isActive && (!region.managerId || region.managerId === editingAccount?.id)).map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}{editingAccount?.regionId && !regions.some((region) => region.id === editingAccount.regionId) && <option value={editingAccount.regionId}>{editingAccount.regionName || 'Wilayah terhubung'} · tidak aktif</option>}</select>
              {accountFieldErrors.regionId && <small className="account-field-error" id="account-region-error" role="alert">{accountFieldErrors.regionId}</small>}
            </label>
            {editingAccount?.regionId && editingAccount.regionIsActive === false && <small className="account-region-warning">Wilayah akun ini sedang nonaktif. Pilih wilayah aktif untuk memindahkan manager.</small>}
          </>}
          {editingAccount && <label htmlFor="account-password">Kata sandi baru <span className="account-optional-label">(opsional)</span><input id="account-password" type="password" autoComplete="new-password" minLength={8} value={accountForm.password} onChange={(event) => updateAccountField('password', event.target.value)} placeholder="Kosongkan jika tidak diubah" aria-invalid={Boolean(accountFieldErrors.password)} aria-describedby={accountFieldErrors.password ? 'account-password-error' : undefined} />{accountFieldErrors.password && <small className="account-field-error" id="account-password-error" role="alert">{accountFieldErrors.password}</small>}<small>Jika kata sandi diubah, semua sesi akun ini akan dikeluarkan.</small></label>}
          <div className="account-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setAccountModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : editingAccount ? 'Simpan perubahan' : <><UserPlus size={15} /> Kirim undangan</>}</button>
          </div>
        </form>
      </ModalForm>
    </AdminShell>
  );
}
