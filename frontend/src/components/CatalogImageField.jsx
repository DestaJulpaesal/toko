import { useEffect, useId, useState } from 'react';
import { apiFetch } from '../services/api';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function CatalogImageField({ value, onChange, group, label = 'Foto katalog' }) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreviewUrl(value || '');
  }, [value]);

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) {
      setError('Gunakan JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setError('');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('group', group);
      const response = await apiFetch('/media/catalog-image', { method: 'POST', body, silentNotify: true });
      const data = await response.json();
      if (!response.ok || !data.success || !data.imageUrl) throw new Error(data.message || 'Gambar gagal diunggah.');
      onChange(data.imageUrl);
      setPreviewUrl(data.imageUrl);
    } catch (uploadError) {
      setPreviewUrl(value || '');
      setError(uploadError.message || 'Gambar gagal diunggah.');
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
    }
  };

  return <div className="catalog-image-field">
    <span className="catalog-image-field-label">{label}</span>
    {previewUrl ? <img className="catalog-image-preview" src={previewUrl} alt="Pratinjau foto katalog" onError={() => setPreviewUrl('')} /> : <div className="catalog-image-empty">Belum ada foto</div>}
    <div className="catalog-image-actions">
      <label className="btn btn-secondary" htmlFor={inputId}>{uploading ? 'Mengunggah...' : previewUrl ? 'Ganti foto' : 'Pilih foto'}</label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadFile} disabled={uploading} hidden />
      {value && <button className="text-button" type="button" onClick={() => { onChange(''); setPreviewUrl(''); }}>Hapus foto</button>}
    </div>
    <small>Foto ini tampil untuk pelanggan. Format JPG, PNG, atau WebP; maksimal 5 MB.</small>
    {error && <small className="catalog-image-error" role="alert">{error}</small>}
  </div>;
}
