import { useEffect, useState } from 'react';
import { Save, Store, Truck, Wallet, Percent, PackageSearch } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
import { showNotice } from '../utils/noticeService';

const defaults = {
  storeProfile: { name: 'Glosir', phone: '', address: '', openingHours: '' },
  delivery: { enabled: true, freeDistanceKm: 1, ratePerKm: 5000, minimumSubtotal: 0 },
  checkout: { paymentMethods: ['CASH', 'QRIS', 'TRANSFER', 'DEBT'] },
  cashierDiscount: { maxPercent: 10, maxAmount: 50000 },
  inventory: { lowStockThreshold: 5, expiryWarningDays: 30 },
};

const paymentOptions = [
  ['CASH', 'Tunai'],
  ['QRIS', 'QRIS'],
  ['TRANSFER', 'Transfer'],
  ['DEBT', 'Bon / utang'],
];

function NumericField({ label, value, onChange, min = 0, step = 1, suffix }) {
  return (
    <label className="g-field">
      <span>{label}</span>
      <span className="g-input-wrap">
        <input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/settings');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pengaturan gagal dimuat.');
      setSettings((current) => ({ ...current, ...data.settings }));
    } catch (error) {
      showNotice(error.message || 'Pengaturan toko gagal dimuat.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const update = (section, field, value) => {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }));
  };

  const save = async (section) => {
    setSaving(section);
    try {
      const response = await apiFetch('/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [section]: settings[section] } }),
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pengaturan gagal disimpan.');
      setSettings((current) => ({ ...current, ...data.settings }));
      showNotice('Pengaturan berhasil disimpan.', 'success');
    } catch (error) {
      showNotice(error.message || 'Pengaturan gagal disimpan. Coba lagi.', 'error');
    } finally {
      setSaving('');
    }
  };

  const sections = [
    { key: 'storeProfile', title: 'Identitas toko', description: 'Informasi publik untuk pelanggan.', icon: Store },
    { key: 'delivery', title: 'Pengiriman', description: 'Atur layanan antar dan ongkos kirim.', icon: Truck },
    { key: 'checkout', title: 'Pembayaran', description: 'Pilih metode pembayaran yang tersedia di kasir.', icon: Wallet },
    { key: 'cashierDiscount', title: 'Poin & diskon', description: 'Tentukan batas diskon manual kasir.', icon: Percent },
    { key: 'inventory', title: 'Stok & peringatan', description: 'Ambang stok rendah dan pengingat kedaluwarsa.', icon: PackageSearch },
  ];

  return (
    <AdminShell active="Pengaturan Toko">
      <header className="admin-header g-page-header">
        <div>
          <p className="eyebrow light">KONFIGURASI TOKO</p>
          <h1>Pengaturan Toko</h1>
          <p className="admin-subtitle">Kelola aturan penting tanpa mengubah kode aplikasi.</p>
        </div>
      </header>
      {loading ? <div className="g-state" role="status">Memuat pengaturan toko…</div> : (
        <div className="g-settings-grid">
          {sections.map(({ key, title, description, icon: Icon }) => (
            <section className="g-panel g-settings-card" key={key}>
              <div className="g-settings-heading">
                <span className="g-settings-icon"><Icon size={20} /></span>
                <div><h2>{title}</h2><p>{description}</p></div>
              </div>
              {key === 'storeProfile' && (
                <div className="g-settings-fields">
                  <label className="g-field"><span>Nama toko</span><input value={settings.storeProfile.name} onChange={(event) => update(key, 'name', event.target.value)} /></label>
                  <label className="g-field"><span>Nomor WhatsApp</span><input value={settings.storeProfile.phone} onChange={(event) => update(key, 'phone', event.target.value)} /></label>
                  <label className="g-field"><span>Alamat</span><textarea rows="2" value={settings.storeProfile.address} onChange={(event) => update(key, 'address', event.target.value)} /></label>
                  <label className="g-field"><span>Jam buka</span><input value={settings.storeProfile.openingHours} onChange={(event) => update(key, 'openingHours', event.target.value)} /></label>
                </div>
              )}
              {key === 'delivery' && (
                <div className="g-settings-fields">
                  <label className="g-checkbox-field"><input type="checkbox" checked={settings.delivery.enabled} onChange={(event) => update(key, 'enabled', event.target.checked)} /> Layanan antar aktif</label>
                  <NumericField label="Jarak gratis" value={settings.delivery.freeDistanceKm} step="0.5" suffix="km" onChange={(value) => update(key, 'freeDistanceKm', value)} />
                  <NumericField label="Tarif setiap km setelah jarak gratis" value={settings.delivery.ratePerKm} suffix="Rp/km" onChange={(value) => update(key, 'ratePerKm', value)} />
                  <NumericField label="Minimal belanja pesanan" value={settings.delivery.minimumSubtotal} suffix="Rp" onChange={(value) => update(key, 'minimumSubtotal', value)} />
                </div>
              )}
              {key === 'checkout' && (
                <div className="g-settings-fields">
                  {paymentOptions.map(([value, label]) => (
                    <label className="g-checkbox-field" key={value}>
                      <input
                        type="checkbox"
                        checked={settings.checkout.paymentMethods.includes(value)}
                        onChange={(event) => {
                          const methods = new Set(settings.checkout.paymentMethods);
                          if (event.target.checked) methods.add(value);
                          else methods.delete(value);
                          update(key, 'paymentMethods', paymentOptions.map(([method]) => method).filter((method) => methods.has(method)));
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
              {key === 'cashierDiscount' && (
                <div className="g-settings-fields g-settings-fields--two">
                  <NumericField label="Batas diskon" value={settings.cashierDiscount.maxPercent} suffix="%" step="0.5" onChange={(value) => update(key, 'maxPercent', value)} />
                  <NumericField label="Batas nominal" value={settings.cashierDiscount.maxAmount} suffix="Rp" onChange={(value) => update(key, 'maxAmount', value)} />
                </div>
              )}
              {key === 'inventory' && (
                <div className="g-settings-fields g-settings-fields--two">
                  <NumericField label="Peringatan stok di bawah" value={settings.inventory.lowStockThreshold} suffix="unit" onChange={(value) => update(key, 'lowStockThreshold', value)} />
                  <NumericField label="Peringatan kedaluwarsa" value={settings.inventory.expiryWarningDays} suffix="hari sebelumnya" onChange={(value) => update(key, 'expiryWarningDays', value)} />
                </div>
              )}
              <div className="g-settings-actions">
                <button type="button" className="g-btn g-btn--primary" disabled={saving !== ''} onClick={() => save(key)}>
                  <Save size={16} /> {saving === key ? 'Menyimpan…' : 'Simpan bagian ini'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
