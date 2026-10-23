import { useEffect, useState } from 'react';
import { AlertCircle, Boxes, PackageCheck, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
import CurrencyInput from '../components/CurrencyInput';
import CatalogImageField from '../components/CatalogImageField';
import ModalForm from '../components/ModalForm';

const emptyPackageForm = { name: '', description: '', imageUrl: '', isManualPrice: false, price: '', items: [] };

export default function AdminEventPackagesPage() {
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState(emptyPackageForm);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    const loadProducts = async () => {
      const response = await apiFetch('/products?all=true');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Produk gagal dimuat.');
      setProducts(data.products || []);
    };
    const loadPackages = async () => {
      const response = await apiFetch('/event-packages');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Paket acara gagal dimuat.');
      setPackages(data.packages || []);
    };
    const results = await Promise.allSettled([loadProducts(), loadPackages()]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  };
  useEffect(() => { load().catch((error) => setNotice(error.message || 'Paket gagal dimuat')); }, []);

  const toggleItem = (variantId) => setForm((current) => ({ ...current, items: current.items.some((item) => item.variantId === variantId) ? current.items.filter((item) => item.variantId !== variantId) : [...current.items, { variantId, quantity: 1 }] }));
  const updateQuantity = (variantId, quantity) => {
    const digits = String(quantity).replace(/\D/g, '');
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.variantId === variantId ? { ...item, quantity: digits } : item),
    }));
  };
  const autoPrice = form.items.reduce((sum, item) => sum + Number(products.find((product) => product.variantId === item.variantId)?.price || 0) * Number(item.quantity || 0), 0);
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(productSearch.toLowerCase().trim()));
  const incompletePackageCount = packages.filter((item) => !item.items?.length).length;
  const totalPackageItems = packages.reduce((total, item) => total + (item.items || []).reduce((itemTotal, entry) => itemTotal + Number(entry.quantity || 0), 0), 0);

  const closeForm = () => {
    setForm(emptyPackageForm);
    setEditingId(null);
    setFormError('');
    setProductSearch('');
    setFormOpen(false);
  };

  const openNewForm = () => {
    setForm(emptyPackageForm);
    setEditingId(null);
    setFormError('');
    setProductSearch('');
    setFormOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!form.name.trim() || !form.items.length || form.items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) || (form.isManualPrice && !form.price)) {
      setFormError('Lengkapi nama, isi paket, dan jumlah barang minimal 1.');
      return false;
    }
    setIsSubmitting(true);
    setFormError('');
    let successMessage = '';
    try {
      const response = await apiFetch(editingId ? `/event-packages/${editingId}` : '/event-packages', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity) })), price: form.isManualPrice ? Number(form.price) : autoPrice }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Paket gagal disimpan');
      successMessage = editingId ? 'Paket acara berhasil diperbarui.' : 'Paket acara berhasil dibuat.';
    } catch (error) {
      setFormError(error.message || 'Paket gagal disimpan.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
    setNotice(successMessage);
    closeForm();
    try {
      await load();
    } catch (error) {
      setNotice(`${successMessage} Daftar paket gagal diperbarui: ${error.message || 'terjadi kesalahan.'}`);
    }
    return true;
  };

  const editPackage = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      isManualPrice: Boolean(item.isManualPrice),
      price: item.isManualPrice ? String(item.price) : '',
      items: (item.items || []).map((entry) => ({ variantId: entry.variantId, quantity: entry.quantity })),
    });
    setProductSearch('');
    setFormError('');
    setFormOpen(true);
  };

  const deletePackage = async (item) => {
    if (!window.confirm(`Hapus paket "${item.name}"? Paket akan disembunyikan dari katalog.`)) return;
    const response = await apiFetch(`/event-packages/${item.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Paket gagal dihapus');
    setNotice('Paket acara berhasil dihapus.');
    if (editingId === item.id) {
      closeForm();
    }
    await load();
  };

  return (
    <AdminShell active="Paket Acara" className="admin-crud-shell tool-page event-package-admin-page">
        <header className="tool-hero"><div><span className="eyebrow">KATALOG PAKET</span><h1>Paket Acara</h1><p className="page-lead">Buat dan kelola bundel kebutuhan hajatan, nikahan, dan acara lainnya.</p></div><div className="event-package-hero-actions"><button type="button" className="btn btn-primary event-package-create-button" onClick={openNewForm}><Plus size={17} /> Buat paket</button><div className="tool-hero-mark">PA<span>+</span></div></div></header>
        {notice && <p className="notice-banner tool-notice" role="status">{notice}</p>}
        <section className="event-package-summary" aria-label="Ringkasan paket acara">
          <div><span className="event-package-summary-icon"><PackageCheck size={17} /></span><span className="event-package-summary-copy"><small>Paket tersimpan</small><strong>{packages.length}</strong></span></div>
          <div><span className="event-package-summary-icon is-blue"><Boxes size={17} /></span><span className="event-package-summary-copy"><small>Produk tersedia</small><strong>{products.length}</strong></span></div>
          <div className={incompletePackageCount ? 'has-incomplete' : ''}><span className={`event-package-summary-icon${incompletePackageCount ? ' is-warning' : ''}`}>{incompletePackageCount ? <AlertCircle size={17} /> : <Boxes size={17} />}</span><span className="event-package-summary-copy"><small>Barang dalam paket</small><strong>{totalPackageItems}</strong><small className={incompletePackageCount ? 'event-package-summary-warning' : ''}>{incompletePackageCount ? `${incompletePackageCount} paket perlu dilengkapi` : 'Komposisi paket sudah terisi'}</small></span></div>
        </section>
        <section className="tool-panel event-package-catalog">
          <div className="tool-panel-heading">
            <div><span className="panel-kicker">Katalog aktif</span><h2>Paket yang sudah dibuat</h2><p className="event-package-panel-help">Cek isi, harga, dan kelengkapan setiap paket di sini.</p></div>
            <span className="tool-count">{packages.length} paket</span>
          </div>
          <div className="package-list">
            {packages.map((item) => {
              const packageItems = item.items || [];
              const itemCount = packageItems.reduce((total, entry) => total + Number(entry.quantity || 0), 0);
              const itemNames = packageItems
                .map((entry) => entry.variant?.product?.name || entry.variant?.name)
                .filter(Boolean);
              return (
                <article className={`package-list-item${packageItems.length ? '' : ' is-incomplete'}`} key={item.id}>
                  <span className="package-list-icon">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <PackagePlus size={21} />}
                  </span>
                  <div className="event-package-list-copy">
                    <div className="event-package-name-row">
                      <strong>{item.name}</strong>
                      <span className={`event-package-composition-badge${packageItems.length ? ' is-ready' : ' is-incomplete'}`}>
                        {packageItems.length ? `${itemCount} barang` : 'Isi belum diatur'}
                      </span>
                    </div>
                    <small>{item.description || (itemNames.length ? itemNames.slice(0, 3).join(', ') : 'Tambahkan barang agar paket siap digunakan.')}</small>
                  </div>
                  <div className="event-package-price-block"><small>Harga paket</small><b className="event-package-list-price">Rp {Number(item.price).toLocaleString('id-ID')}</b></div>
                  <div className="package-list-actions">
                    <button type="button" className="btn small event-package-action event-package-action-edit" aria-label={`Edit ${item.name}`} onClick={() => editPackage(item)}><Pencil size={15} /> Lengkapi / Edit</button>
                    <button type="button" className="btn small event-package-action event-package-action-delete" aria-label={`Hapus ${item.name}`} onClick={() => deletePackage(item).catch((error) => setNotice(error.message))}><Trash2 size={15} /> Hapus</button>
                  </div>
                </article>
              );
            })}
            {!packages.length && <div className="tool-empty event-package-empty"><PackagePlus size={30} /><strong>Belum ada paket acara</strong><span>Buat paket pertama untuk mulai mengelola katalog acara.</span><button type="button" className="btn btn-primary" onClick={openNewForm}><Plus size={16} /> Buat paket pertama</button></div>}
          </div>
        </section>
        <ModalForm
          isOpen={formOpen}
          onClose={closeForm}
          title={editingId ? 'Edit paket acara' : 'Buat paket acara'}
          subtitle="Lengkapi detail paket, pilih barang, lalu tentukan cara menghitung harganya."
          kicker={editingId ? 'PERBARUI KATALOG' : 'KATALOG PAKET'}
          maxWidth="980px"
          cardClassName="event-package-modal-card"
        >
          <form className="event-package-modal-form" onSubmit={(event) => submit(event).catch((error) => setFormError(error.message || 'Paket gagal disimpan.'))}>
            {formError && <p className="event-package-form-error" role="alert">{formError}</p>}
            <div className="tool-form-grid event-package-details"><label className="tool-field">Nama paket<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Paket Sembako Hajatan 50 Porsi" required /></label><label className="tool-field">Deskripsi<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Jelaskan isi paket dan acara yang cocok" /></label></div>
            <CatalogImageField value={form.imageUrl || ''} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} group="event-packages" label="Foto paket acara" />
            <fieldset className="package-picker event-package-picker"><legend>Pilih isi paket <small>{form.items.length} dipilih</small></legend><div className="picker-toolbar"><span>Pilih barang penyusun paket</span><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama, SKU, atau barcode..." /></div><div className="package-options">{filteredProducts.map((product) => { const selectedItem = form.items.find((item) => item.variantId === product.variantId); return <div key={product.variantId} className={`package-option${selectedItem ? ' selected' : ''}`}><input type="checkbox" aria-label={`Pilih ${product.name}`} checked={Boolean(selectedItem)} onChange={() => toggleItem(product.variantId)} /><button type="button" className="package-option-copy" onClick={() => toggleItem(product.variantId)}><strong>{product.name}</strong><small>Rp {Number(product.price).toLocaleString('id-ID')} · stok {product.stock}</small></button>{selectedItem && <input className="quantity-input" aria-label={`Jumlah ${product.name}`} type="text" inputMode="numeric" pattern="[0-9]*" value={selectedItem.quantity} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => updateQuantity(product.variantId, event.target.value)} />}</div>; })}{!filteredProducts.length && <div className="picker-empty">Barang tidak ditemukan.</div>}</div></fieldset>
            <div className="tool-price-row event-package-price-row"><label className="toggle-field"><input type="checkbox" checked={form.isManualPrice} onChange={(event) => setForm({ ...form, isManualPrice: event.target.checked })} /><span><strong>Gunakan harga manual</strong><small>Atur harga khusus atau hasil nego.</small></span></label>{form.isManualPrice ? <label className="tool-field compact-field">Harga paket<CurrencyInput value={form.price} onValueChange={(value) => setForm({ ...form, price: value })} placeholder="Rp 5.000.000" required /></label> : <div className="tool-price-preview"><small>Harga otomatis dari isi paket</small><strong>Rp {autoPrice.toLocaleString('id-ID')}</strong></div>}</div>
            <div className="event-package-modal-actions"><button className="btn btn-secondary" type="button" onClick={closeForm} disabled={isSubmitting}>Batal</button><button className="btn btn-primary tool-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : editingId ? 'Perbarui paket' : 'Simpan paket'} <span>→</span></button></div>
          </form>
        </ModalForm>
      </AdminShell>
  );
}
